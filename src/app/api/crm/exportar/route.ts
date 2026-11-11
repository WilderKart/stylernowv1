import { listarClientesCRM } from "@/app/panel/crm/actions";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { generarExcel } from "@/lib/export/excel";
import { generarReportePdf } from "@/lib/export/pdf";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import type { NextRequest } from "next/server";

/**
 * GET /api/crm/exportar — ADR-014, Fase D. "Exportar clientes" es exclusivo
 * de Barbería (03-Business-Rules/01_Roles.md) — `listarClientesCRM()` no
 * conoce ese permiso, solo aplica RLS por negocio, así que esta ruta lo
 * verifica explícitamente contra `resolverContexto().permisos.exportarClientes`
 * antes de generar nada. El `negocioId` sale del contexto resuelto server-side,
 * nunca de un parámetro del cliente — evita que alcance un negocio ajeno
 * simplemente cambiando el query string.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const formato = searchParams.get("formato"); // "excel" | "pdf"
  if (formato !== "excel" && formato !== "pdf") {
    return new Response("Parámetros inválidos", { status: 400 });
  }

  const contexto = await resolverContexto();
  if (!contexto.userId) return new Response("No autorizado", { status: 401 });
  if (!contexto.permisos.exportarClientes || !contexto.negocioId) {
    return new Response("No tenés permiso para exportar clientes.", { status: 403 });
  }

  const supabase = await createClient();
  const [res, { data: negocio }] = await Promise.all([
    listarClientesCRM({ negocioId: contexto.negocioId, limite: 5000 }),
    supabase.from("negocio").select("nombre").eq("id", contexto.negocioId).single(),
  ]);
  if (!res.ok) return new Response(res.error, { status: 403 });

  const filas = res.data.items.map((c) => ({
    nombre: c.nombre,
    telefono: c.telefono ?? "",
    visitas: c.visitas,
    ltv: c.ltv,
    ultimaVisita: c.ultimaVisita ? c.ultimaVisita.slice(0, 10) : "",
    etiquetas: c.etiquetas.join(" | "),
  }));
  const nombreArchivo = `clientes-${contexto.negocioId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`;

  if (formato === "excel") {
    const buffer = await generarExcel(
      [
        {
          nombre: "Clientes",
          columnas: [
            { header: "Nombre", key: "nombre", width: 26 },
            { header: "Teléfono", key: "telefono", width: 16 },
            { header: "Visitas", key: "visitas", width: 10 },
            { header: "LTV", key: "ltv", width: 14, formato: "moneda" },
            { header: "Última visita", key: "ultimaVisita", width: 14 },
            { header: "Etiquetas", key: "etiquetas", width: 24 },
          ],
          filas,
        },
      ],
      `Clientes — ${negocio?.nombre ?? "StylerNow"}`
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}.xlsx"`,
      },
    });
  }

  const pdfBytes = await generarReportePdf({
    titulo: "Clientes",
    negocioNombre: negocio?.nombre ?? "StylerNow",
    filtros: [`${filas.length} clientes`],
    columnas: [
      { header: "Nombre", key: "nombre", width: 150 },
      { header: "Teléfono", key: "telefono", width: 85 },
      { header: "Visitas", key: "visitas", width: 55, alineacion: "derecha" },
      { header: "LTV", key: "ltvFormato", width: 90, alineacion: "derecha" },
      { header: "Última visita", key: "ultimaVisita", width: 80 },
    ],
    filas: filas.map((f) => ({ ...f, ltvFormato: formatCOP(f.ltv) })),
  });
  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}.pdf"`,
    },
  });
}
