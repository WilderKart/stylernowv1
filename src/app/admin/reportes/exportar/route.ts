import { requireSuperSU } from "@/lib/auth/require-supersu";
import { leerRango } from "../../_componentes/rango";
import { rpcAdmin } from "../../_componentes/rpc";
import type { Reporte } from "../tipos";

/** CSV del reporte (mismo rango que la pantalla). Solo Super Admin; la base vuelve a verificar is_supersu(). */
export async function GET(request: Request) {
  await requireSuperSU();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const rango = leerRango(sp, "30d");
  const res = await rpcAdmin<Reporte>("admin_reporte", { p_desde: rango.desde.toISOString(), p_hasta: rango.hasta.toISOString() });
  if (!res.ok) return new Response(res.error, { status: 400 });

  // Comillas y fórmulas neutralizadas (evita inyección de fórmulas al abrir en Excel).
  const celda = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const filas: unknown[][] = [
    ["Reporte StylerNow", `${rango.desdeTexto} a ${rango.hastaTexto}`],
    [],
    ["Dia", "Reservas", "Completadas", "Canceladas/no asistio", "Usuarios nuevos"],
    ...res.data.serie.map((d) => [d.dia, d.reservas, d.completadas, d.canceladas, d.usuarios]),
    [],
    ["Negocio", "Ciudad", "Reservas", "Completadas", "Valor atendido COP"],
    ...res.data.top_negocios.map((n) => [n.nombre, n.ciudad ?? "", n.reservas, n.completadas, n.valor]),
    [],
    ["Pagos aprobados COP", res.data.pagos.monto_aprobado],
    ["Reembolsado COP", res.data.pagos.reembolsado],
    ["Comision plataforma COP", res.data.pagos.comision_plataforma],
  ];
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stylernow-reporte-${rango.desdeTexto}-a-${rango.hastaTexto}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
