import { ETIQUETA_LIQUIDACION } from "@/lib/ganancias/tipos";
import { formatCOP } from "@/lib/utils";

interface Datos {
  liquidacion: {
    id: string; numero: number; staff_nombre: string | null; periodo_tipo: string; desde: string; hasta: string; estado: string;
    total_comisiones: number; total_ajustes: number; total_neto: number; pagado: number; servicios: number; produccion: number; cerrada_at: string;
  };
  negocio: string | null;
  sede: string | null;
  cerrada_por: string | null;
  servicios: Array<{ fecha: string; servicio: string; precio: number; descuento: number; pct: number | null; comision: number }>;
  ajustes: Array<{ fecha: string; motivo: string; monto: number }>;
  pagos: Array<{ fecha: string; monto: number; medio: string; referencia: string | null; estado: string }>;
}

const f = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bogota" });

/** Comprobante de liquidación imprimible (el navegador lo guarda como PDF). Solo muestra lo que la base devolvió a quien lo pidió. */
export function Comprobante({ d }: { d: Datos }) {
  const l = d.liquidacion;
  return (
    <article className="mx-auto w-full max-w-3xl border-2 border-border bg-surface p-6 text-[13px] text-text print:border-0 print:p-0">
      <header className="mb-4 border-b-2 border-border pb-3">
        <p className="font-mono text-[11px] uppercase text-text-muted">Comprobante de liquidación</p>
        <h1 className="text-[20px] font-bold">N.º {l.numero} · {d.negocio ?? "Negocio"}</h1>
        <p className="text-text-muted">{d.sede ?? "Todas las sedes"} · Cerrada el {f(l.cerrada_at)}{d.cerrada_por ? ` por ${d.cerrada_por}` : ""}</p>
        <p className="mt-1">Profesional: <b>{l.staff_nombre ?? "—"}</b> · Período {f(l.desde)} – {f(l.hasta)} ({l.periodo_tipo.toLowerCase()}) · {ETIQUETA_LIQUIDACION[l.estado] ?? l.estado}</p>
        <p className="font-mono text-[10.5px] text-text-muted">ID {l.id}</p>
      </header>
      <h2 className="mb-1 font-bold uppercase">Servicios ({l.servicios})</h2>
      <table className="mb-4 w-full text-left">
        <thead className="font-mono text-[10.5px] uppercase text-text-muted"><tr><th>Fecha</th><th>Servicio</th><th className="text-right">Precio</th><th className="text-right">Desc.</th><th className="text-right">%</th><th className="text-right">Comisión</th></tr></thead>
        <tbody>{d.servicios.map((s, i) => (<tr key={i} className="border-t border-border-subtle"><td>{f(s.fecha)}</td><td>{s.servicio}</td><td className="text-right">{formatCOP(s.precio)}</td><td className="text-right">{s.descuento > 0 ? formatCOP(s.descuento) : "—"}</td><td className="text-right">{s.pct ?? "—"}</td><td className="text-right">{formatCOP(s.comision)}</td></tr>))}</tbody>
      </table>
      {d.ajustes.length > 0 ? (
        <>
          <h2 className="mb-1 font-bold uppercase">Ajustes</h2>
          <ul className="mb-4">{d.ajustes.map((a, i) => (<li key={i} className="flex justify-between border-t border-border-subtle py-1"><span>{f(a.fecha)} · {a.motivo}</span><b>{formatCOP(a.monto)}</b></li>))}</ul>
        </>
      ) : null}
      <dl className="mb-4 grid grid-cols-2 gap-1 border-t-2 border-border pt-3">
        <dt>Producción</dt><dd className="text-right">{formatCOP(l.produccion)}</dd>
        <dt>Comisiones</dt><dd className="text-right">{formatCOP(l.total_comisiones)}</dd>
        <dt>Ajustes</dt><dd className="text-right">{formatCOP(l.total_ajustes)}</dd>
        <dt className="font-bold">Total a pagar</dt><dd className="text-right font-bold">{formatCOP(l.total_neto)}</dd>
        <dt>Pagado</dt><dd className="text-right">{formatCOP(l.pagado)}</dd>
        <dt className="font-bold">Saldo</dt><dd className="text-right font-bold">{formatCOP(l.total_neto - l.pagado)}</dd>
      </dl>
      {d.pagos.length > 0 ? (
        <>
          <h2 className="mb-1 font-bold uppercase">Pagos registrados</h2>
          <ul>{d.pagos.map((p, i) => (<li key={i} className={`flex justify-between border-t border-border-subtle py-1 ${p.estado === "ANULADO" ? "line-through text-text-muted" : ""}`}><span>{f(p.fecha)} · {p.medio}{p.referencia ? ` · ${p.referencia}` : ""}</span><b>{formatCOP(p.monto)}</b></li>))}</ul>
        </>
      ) : null}
      <p className="mt-4 text-[11px] text-text-muted">Los pagos son registros manuales del negocio; StylerNow no mueve dinero entre el negocio y su equipo.</p>
    </article>
  );
}
