import { Badge, Card } from "@/components/ui/card";
import {
  CATEGORIAS,
  ESTADOS,
  ETIQUETA_CATEGORIA,
  ETIQUETA_ESTADO,
  resumenEconomico,
  type FiltrosLibro,
  type MovimientoLibro,
  type TotalLibro,
} from "@/lib/libro/filtros";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";

/**
 * Vista del libro financiero (servidor, sin JavaScript de cliente): filtros por formulario GET,
 * tabla paginada, totales y exportación. La usan /panel/libro (negocio) y /admin/libro (StylerNow).
 */

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" });
}

function monto(v: number, moneda: string) {
  return moneda === "COP" ? formatCOP(Number(v)) : `${Number(v).toLocaleString("es-CO")} ${moneda}`;
}

const TONO: Record<string, "success" | "danger" | "accent" | "neutral"> = {
  CONFIRMADO: "success",
  FALLIDO: "danger",
  REQUIERE_REVISION: "danger",
  PENDIENTE: "accent",
  INFORMATIVO: "neutral",
};

export function VistaLibro({
  modo,
  filtros,
  filas,
  total,
  totales,
  tamanoPagina,
}: {
  modo: "panel" | "admin";
  filtros: FiltrosLibro;
  filas: MovimientoLibro[];
  total: number;
  totales: TotalLibro[];
  tamanoPagina: number;
}) {
  const base = modo === "admin" ? "/admin/libro" : "/panel/libro";
  const paginas = Math.max(1, Math.ceil(total / tamanoPagina));
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filtros, ...extra })) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
    return p.toString();
  };
  const exportar = (formato: "csv" | "xlsx") => `/api/libro/exportar?${qs({ modo, formato, pagina: undefined })}`;
  const resumen = resumenEconomico(totales);
  const porCategoria = new Map<string, { cantidad: number; total: number; moneda: string }>();
  for (const t of totales) {
    if (t.estado !== "CONFIRMADO" || t.sentido === "INFORMATIVO") continue;
    const k = `${t.categoria}|${t.sentido}|${t.moneda}`;
    const v = porCategoria.get(k) ?? { cantidad: 0, total: 0, moneda: t.moneda };
    v.cantidad += t.cantidad;
    v.total += t.total;
    porCategoria.set(k, v);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="sn-meta">
        Registro de lo que pasó con cada pago, anticipo, reembolso y ajuste, tal como lo confirmaron los sistemas de
        origen. No es un saldo disponible ni dinero en custodia: un pago solo figura como confirmado con la evidencia del
        proveedor, y las correcciones se registran como ajustes sin borrar el movimiento original.
      </p>

      <form method="get" action={base} className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Desde
          <input type="date" name="desde" defaultValue={filtros.desde ?? ""} className="h-11 border-2 border-border bg-bg px-3" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Hasta
          <input type="date" name="hasta" defaultValue={filtros.hasta ?? ""} className="h-11 border-2 border-border bg-bg px-3" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Categoría
          <select name="categoria" defaultValue={filtros.categoria ?? ""} className="h-11 border-2 border-border bg-bg px-3">
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Estado
          <select name="estado" defaultValue={filtros.estado ?? ""} className="h-11 border-2 border-border bg-bg px-3">
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Referencia (pago, reserva, reembolso o id externo)
          <input name="referencia" defaultValue={filtros.referencia ?? ""} maxLength={80} className="h-11 border-2 border-border bg-bg px-3" />
        </label>
        {modo === "admin" ? (
          <>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Negocio (id)
              <input name="negocioId" defaultValue={filtros.negocioId ?? ""} className="h-11 border-2 border-border bg-bg px-3" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Entidad
              <select name="entidad" defaultValue={filtros.entidad ?? ""} className="h-11 border-2 border-border bg-bg px-3">
                <option value="">Todas</option>
                <option value="NEGOCIO">Negocios</option>
                <option value="PLATAFORMA">StylerNow</option>
              </select>
            </label>
          </>
        ) : null}
        <div className="flex flex-wrap items-end gap-2 sm:col-span-3">
          <button type="submit" className="h-11 border-2 border-ink bg-ink px-4 text-[13px] font-bold text-paper">
            Filtrar
          </button>
          <Link href={base} className="flex h-11 items-center border-2 border-border px-4 text-[13px] font-bold">
            Limpiar
          </Link>
          <a href={exportar("csv")} className="flex h-11 items-center border-2 border-border px-4 text-[13px] font-bold">
            Exportar CSV
          </a>
          <a href={exportar("xlsx")} className="flex h-11 items-center border-2 border-border px-4 text-[13px] font-bold">
            Exportar Excel
          </a>
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-2">
        {resumen.length === 0 ? (
          <Card className="p-4 text-[13px]">Sin movimientos confirmados en este filtro.</Card>
        ) : (
          resumen.map((r) => (
            <Card key={r.moneda} className="flex flex-col gap-1 p-4">
              <span className="sn-label">Confirmado en el filtro ({r.moneda})</span>
              <span className="text-[13px]">Ingresos: {monto(r.ingresos, r.moneda)}</span>
              <span className="text-[13px]">Egresos: {monto(r.egresos, r.moneda)}</span>
              <span className="text-[15px] font-bold">Neto: {monto(r.neto, r.moneda)}</span>
            </Card>
          ))
        )}
        {porCategoria.size > 0 ? (
          <Card className="p-4 sm:col-span-2">
            <span className="sn-label">Por categoría (confirmados)</span>
            <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-[13px] sm:grid-cols-2">
              {[...porCategoria.entries()].map(([k, v]) => {
                const [cat, sentido] = k.split("|");
                return (
                  <li key={k}>
                    {ETIQUETA_CATEGORIA[cat as keyof typeof ETIQUETA_CATEGORIA] ?? cat} ({sentido === "INGRESO" ? "ingreso" : "egreso"}):{" "}
                    {monto(v.total, v.moneda)} · {v.cantidad}
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
      </section>

      <div className="overflow-x-auto border-2 border-border">
        <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
          <caption className="sr-only">Movimientos del libro financiero</caption>
          <thead>
            <tr className="border-b-2 border-border text-left">
              <th className="p-2">Fecha</th>
              {modo === "admin" ? <th className="p-2">Entidad</th> : null}
              <th className="p-2">Categoría</th>
              <th className="p-2">Evento</th>
              <th className="p-2">Estado</th>
              <th className="p-2 text-right">Monto</th>
              <th className="p-2">Proveedor / id</th>
              <th className="p-2">Referencia</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  No hay movimientos con estos filtros.
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.id} className="border-b border-grid-soft align-top">
                  <td className="p-2 whitespace-nowrap">{fecha(f.ocurrido_at)}</td>
                  {modo === "admin" ? <td className="p-2">{f.entidad === "PLATAFORMA" ? "StylerNow" : "Negocio"}</td> : null}
                  <td className="p-2">{ETIQUETA_CATEGORIA[f.categoria] ?? f.categoria}</td>
                  <td className="p-2">
                    {f.evento.replaceAll("_", " ").toLowerCase()}
                    {f.motivo ? <div className="text-text-muted">{f.motivo}</div> : null}
                  </td>
                  <td className="p-2">
                    <Badge tone={TONO[f.estado] ?? "neutral"}>{ETIQUETA_ESTADO[f.estado] ?? f.estado}</Badge>
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {f.sentido === "EGRESO" ? "−" : f.sentido === "INGRESO" ? "+" : ""}
                    {monto(f.monto, f.moneda)}
                  </td>
                  <td className="p-2 break-all">
                    {f.proveedor ?? "—"}
                    {f.id_externo ? <div className="text-text-muted">{f.id_externo}</div> : null}
                  </td>
                  <td className="p-2 break-all text-text-muted">
                    {f.referencia_tipo} {f.referencia_id.slice(0, 8)}
                    {f.ajusta_movimiento_id ? <div>ajusta {f.ajusta_movimiento_id.slice(0, 8)}</div> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span>
          {total} movimientos · página {filtros.pagina} de {paginas}
        </span>
        <span className="flex gap-2">
          {filtros.pagina > 1 ? (
            <Link className="border-2 border-border px-3 py-1 font-bold" href={`${base}?${qs({ pagina: filtros.pagina - 1 })}`}>
              Anterior
            </Link>
          ) : null}
          {filtros.pagina < paginas ? (
            <Link className="border-2 border-border px-3 py-1 font-bold" href={`${base}?${qs({ pagina: filtros.pagina + 1 })}`}>
              Siguiente
            </Link>
          ) : null}
        </span>
      </nav>
    </div>
  );
}
