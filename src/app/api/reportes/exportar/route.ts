import { generarExcel } from "@/lib/export/excel";
import { generarReportePdf } from "@/lib/export/pdf";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { exigirOperativo } from "@/lib/suscripcion/estado-operativo";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import type { NextRequest } from "next/server";
import { z } from "zod";

/**
 * GET /api/reportes/exportar — ADR-014, Fase D. Ruta dedicada (no Server
 * Action) porque una descarga binaria real necesita controlar
 * Content-Type/Content-Disposition, algo que una Server Action no puede
 * hacer directamente hacia el navegador. Usa `createClient()` (nunca
 * `createAdminClient()`) para que la RPC de reportes siga aplicando su
 * propia autorización (`tiene_acceso_interno`) — esta ruta nunca decide
 * por sí misma quién puede exportar qué.
 */
const ESQUEMA_EXPORTAR = z.object({
  negocioId: z.string().uuid(),
  formato: z.enum(["excel", "pdf"]),
  desde: z.string().date().optional(),
  hasta: z.string().date().optional(),
  agrupacion: z.enum(["semana", "mes"]).default("mes"),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parse = ESQUEMA_EXPORTAR.safeParse({
    negocioId: searchParams.get("negocioId") ?? undefined,
    formato: searchParams.get("formato") ?? undefined,
    desde: searchParams.get("desde") ?? undefined,
    hasta: searchParams.get("hasta") ?? undefined,
    agrupacion: searchParams.get("agrupacion") ?? "mes",
  });
  if (!parse.success) {
    return new Response("Parámetros inválidos", { status: 400 });
  }
  const { negocioId, formato, desde, hasta, agrupacion } = parse.data;


  const contexto = await resolverContexto();
  if (!contexto.userId) return new Response("No autorizado", { status: 401 });
  if (contexto.rol !== "BARBERIA" && contexto.rol !== "GUARDIAN" && contexto.rol !== "ADMIN") {
    return new Response("No autorizado", { status: 403 });
  }
  if (contexto.negocioId !== negocioId) return new Response("No autorizado", { status: 403 });

  const operativo = await exigirOperativo(negocioId);
  if (!operativo.ok) return new Response("Suscripci?n restringida", { status: 403 });

  const supabase = await createClient();
  const [{ data: ingresos, error }, { data: negocio }] = await Promise.all([
    supabase.rpc("reportes_ingresos_periodo", { p_negocio_id: negocioId, p_desde: desde, p_hasta: hasta, p_agrupacion: agrupacion }),
    supabase.from("negocio").select("nombre").eq("id", negocioId).single(),
  ]);
  if (error) return new Response(error.message, { status: 403 });

  const filas = (ingresos ?? []).map((p) => ({
    periodo: p.periodo!,
    ingresos: Number(p.ingresos),
    ingresosFormato: formatCOP(Number(p.ingresos)),
    citasCompletadas: p.citas_completadas!,
  }));
  const nombreArchivo = `reporte-ingresos-${negocioId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`;

  if (formato === "excel") {
    const buffer = await generarExcel(
      [
        {
          nombre: "Ingresos",
          columnas: [
            { header: "Período", key: "periodo", width: 16 },
            { header: "Ingresos", key: "ingresos", width: 18, formato: "moneda" },
            { header: "Citas completadas", key: "citasCompletadas", width: 18 },
          ],
          filas,
        },
      ],
      `Reporte de ingresos — ${negocio?.nombre ?? "StylerNow"}`
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}.xlsx"`,
      },
    });
  }

  const pdfBytes = await generarReportePdf({
    titulo: "Reporte de ingresos",
    negocioNombre: negocio?.nombre ?? "StylerNow",
    filtros: [
      `Período: ${desde ?? "inicio"} — ${hasta ?? "hoy"}`,
      `Agrupación: ${agrupacion === "semana" ? "Semanal" : "Mensual"}`,
    ],
    columnas: [
      { header: "Período", key: "periodo", width: 150 },
      { header: "Ingresos", key: "ingresosFormato", width: 150, alineacion: "derecha" },
      { header: "Citas completadas", key: "citasCompletadas", width: 150, alineacion: "derecha" },
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
