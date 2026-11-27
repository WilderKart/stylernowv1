import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { aCsv } from "@/lib/ganancias/csv";
import { argumentosListar, leerFiltros } from "@/lib/ganancias/filtros";
import { llamar } from "@/lib/ganancias/rpc";
import type { Capacidades, ListaGanancias } from "@/lib/ganancias/tipos";

export const dynamic = "force-dynamic";

const MAX_FILAS = 5000;
const POR_PAGINA = 100;

/**
 * Exportación CSV de las ganancias del negocio de la SESIÓN. Exige la capacidad «exportar», usa la misma función de lectura que la
 * pantalla (mismos permisos y alcance por sede) y deja constancia en la auditoría. Tope de filas para no sobrecargar la base.
 */
export async function GET(request: Request) {
  const contexto = await resolverContexto();
  if (!contexto.userId || !contexto.negocioId || (contexto.rol !== "BARBERIA" && contexto.rol !== "ADMIN" && contexto.rol !== "GUARDIAN")) {
    return new Response("No autorizado", { status: 403 });
  }
  const negocioId = contexto.negocioId;
  const caps = await llamar<Capacidades>("ganancia_mis_capacidades", { p_negocio: negocioId });
  if (!caps.ok || !caps.data.exportar) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const filtros = leerFiltros(Object.fromEntries(url.searchParams.entries()));
  const filas: unknown[][] = [];
  for (let pagina = 1; filas.length < MAX_FILAS; pagina++) {
    const r = await llamar<ListaGanancias>("ganancias_listar", argumentosListar({ ...filtros, pagina }, negocioId, POR_PAGINA));
    if (!r.ok) return new Response("No se pudo generar la exportación", { status: 500 });
    for (const f of r.data.filas) {
      filas.push([
        f.fecha, f.servicio, f.categoria, f.cliente, f.profesional, f.sede, f.precio_original, f.descuento, f.base_tipo, f.base_comision,
        f.pct, f.comision, f.participacion_negocio, f.estado_cobro, f.estado_comision, f.liquidacion_id, f.reserva_id,
      ]);
    }
    if (r.data.filas.length < POR_PAGINA) break;
  }

  const registro = await llamar("ganancia_exportacion_registrar", {
    p_negocio: negocioId, p_formato: "CSV", p_filtros: Object.fromEntries(url.searchParams.entries()), p_filas: filas.length,
  });
  if (!registro.ok) return new Response("No autorizado", { status: 403 });

  const csv = aCsv(
    ["Fecha", "Servicio", "Categoría", "Cliente", "Profesional", "Sede", "Precio original", "Descuento", "Base", "Base de comisión", "Porcentaje", "Comisión", "Participación negocio", "Estado cobro", "Estado comisión", "Liquidación", "Reserva"],
    filas.slice(0, MAX_FILAS)
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ganancias-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
