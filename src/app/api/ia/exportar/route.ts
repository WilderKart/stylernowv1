import { listarConsumoIa } from "@/app/panel/ia/actions";
import { generarExcel } from "@/lib/export/excel";
import { generarReportePdf } from "@/lib/export/pdf";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

/**
 * GET /api/ia/exportar — ADR-014, Fase D (cierra el hallazgo de
 * `docs/TECH_DEBT_REGISTER.md`: el consumo de IA solo tenía CSV). No hay un
 * permiso separado para exportar consumo de IA — cualquiera que pueda ver
 * `/panel/ia` ya podía exportarlo en CSV. Además de la RLS de `listarConsumoIa()`,
 * esta ruta verifica EXPLÍCITAMENTE en el servidor (RPC `tiene_acceso_interno`)
 * que la persona autenticada pertenece al negocio pedido antes de devolver
 * cualquier archivo, incluso uno vacío (el nombre del negocio no se filtra).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const negocioId = searchParams.get("negocioId");
  const formato = searchParams.get("formato"); // "excel" | "pdf"

  if (!negocioId || (formato !== "excel" && formato !== "pdf")) {
    return new Response("Parámetros inválidos", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  // Pertenencia al negocio (dueño, guardián o staff vinculado). Se valida en el servidor, no se confía en el parámetro.
  const { data: pertenece, error: errAcceso } = await supabase.rpc("tiene_acceso_interno", { p_negocio_id: negocioId });
  if (errAcceso || pertenece !== true) return new Response("Prohibido", { status: 403 });

  const [resConsumo, { data: negocio }] = await Promise.all([
    listarConsumoIa(negocioId),
    supabase.from("negocio").select("nombre").eq("id", negocioId).single(),
  ]);
  if (!resConsumo.ok) return new Response(resConsumo.error, { status: 403 });

  const filas = resConsumo.data.map((c) => ({
    fecha: c.createdAt.slice(0, 10),
    funcion: c.funcion,
    nivel: c.nivel,
    creditosConsumidos: c.creditosConsumidos,
    saldoRestante: c.saldoRestante,
  }));
  const nombreArchivo = `consumo-ia-${negocioId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`;

  if (formato === "excel") {
    const buffer = await generarExcel(
      [
        {
          nombre: "Consumo IA",
          columnas: [
            { header: "Fecha", key: "fecha", width: 14, formato: "fecha" },
            { header: "Función", key: "funcion", width: 24 },
            { header: "Nivel", key: "nivel", width: 10 },
            { header: "Créditos consumidos", key: "creditosConsumidos", width: 20 },
            { header: "Saldo restante", key: "saldoRestante", width: 16 },
          ],
          filas,
        },
      ],
      `Consumo de IA — ${negocio?.nombre ?? "StylerNow"}`
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}.xlsx"`,
      },
    });
  }

  const pdfBytes = await generarReportePdf({
    titulo: "Consumo de IA",
    negocioNombre: negocio?.nombre ?? "StylerNow",
    filtros: [`Últimos ${filas.length} registros`],
    columnas: [
      { header: "Fecha", key: "fecha", width: 85 },
      { header: "Función", key: "funcion", width: 160 },
      { header: "Nivel", key: "nivel", width: 55, alineacion: "derecha" },
      { header: "Créditos", key: "creditosConsumidos", width: 90, alineacion: "derecha" },
      { header: "Saldo restante", key: "saldoRestante", width: 110, alineacion: "derecha" },
    ],
    filas,
  });
  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}.pdf"`,
    },
  });
}
