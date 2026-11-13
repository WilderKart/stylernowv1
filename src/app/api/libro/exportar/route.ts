import { generarExcel } from "@/lib/export/excel";
import { alcanceLibro, movimientosParaExportar } from "@/lib/libro/consultas";
import { aCsv, ENCABEZADOS_EXPORTACION, ETIQUETA_CATEGORIA, leerFiltros } from "@/lib/libro/filtros";
import type { NextRequest } from "next/server";

/**
 * GET /api/libro/exportar?modo=panel|admin&formato=csv|xlsx&desde=&hasta=&categoria=&estado=&referencia=&negocioId=
 *
 * Cero confianza: el alcance (qué negocio, si puede ver StylerNow) sale de la sesión verificada en
 * el servidor, y la consulta corre con el cliente del usuario, así que la RLS del libro aplica igual
 * que en pantalla. Un negocio no puede exportar datos de otro aunque cambie `negocioId` en la URL.
 */
export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const modo = sp.modo === "admin" ? "admin" : "panel";
  const formato = sp.formato === "xlsx" ? "xlsx" : "csv";
  const filtros = leerFiltros(sp);

  let alcance;
  try {
    alcance = await alcanceLibro(modo, filtros.negocioId);
  } catch (e) {
    const status = e instanceof Error && e.message === "NO_AUTENTICADO" ? 401 : 403;
    return new Response("no autorizado", { status });
  }

  let resultado;
  try {
    resultado = await movimientosParaExportar(alcance, filtros);
  } catch {
    return new Response("no se pudo generar la exportación", { status: 500 });
  }

  const sello = new Date().toISOString().slice(0, 10);
  const nombre = `libro-financiero-${sello}`;
  const cabeceras: Record<string, string> = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(resultado.truncado ? { "X-Exportacion-Truncada": "true" } : {}),
  };

  if (formato === "csv") {
    return new Response(aCsv(resultado.filas), {
      headers: { ...cabeceras, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nombre}.csv"` },
    });
  }

  const buffer = await generarExcel(
    [
      {
        nombre: "Movimientos",
        columnas: ENCABEZADOS_EXPORTACION.map(([key, header]) => ({
          key,
          header,
          width: key === "monto" ? 14 : 22,
          formato: key === "monto" ? ("moneda" as const) : undefined,
        })),
        // exceljs guarda los textos como texto (no fórmulas), así que no hay inyección de fórmulas.
        filas: resultado.filas.map((f) => ({ ...f, categoria: ETIQUETA_CATEGORIA[f.categoria] ?? f.categoria, monto: Number(f.monto) })),
      },
    ],
    "Libro financiero StylerNow"
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      ...cabeceras,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
    },
  });
}
