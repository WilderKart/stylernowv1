import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ETIQUETA_COBRO, ETIQUETA_ESTADO_COMISION, type FilaGanancia, type ResumenGanancias } from "@/lib/ganancias/tipos";
import { TAMANO_PAGINA, type FiltrosGanancias } from "@/lib/ganancias/filtros";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";

const TONO_COMISION: Record<string, "success" | "danger" | "accent" | "neutral"> = {
  PENDIENTE: "accent", LIQUIDADA: "success", EN_REVISION: "danger", SIN_REGLA: "danger", REVERTIDA: "neutral",
};

function fechaCorta(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="min-w-0 border-2 border-border bg-surface p-3">
      <p className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-text-muted">{titulo}</p>
      <p className="mt-1 truncate text-[20px] font-bold text-text">{valor}</p>
      {nota ? <p className="mt-0.5 text-[11.5px] text-text-muted">{nota}</p> : null}
    </div>
  );
}

export function ResumenCards({ r, esProfesional }: { r: ResumenGanancias; esProfesional: boolean }) {
  return (
    <section aria-label="Resumen" className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
      <Tarjeta titulo="Servicios" valor={String(r.servicios)} nota={`Ticket promedio ${formatCOP(r.ticket_promedio)}`} />
      <Tarjeta titulo="Producción bruta" valor={formatCOP(r.produccion_bruta)} nota={`Neta ${formatCOP(r.produccion_neta)} · desc. ${formatCOP(r.descuentos)}`} />
      <Tarjeta titulo={esProfesional ? "Mi comisión generada" : "Comisiones generadas"} valor={formatCOP(r.comisiones_generadas)} nota={`Pendiente ${formatCOP(r.comisiones_pendientes)}`} />
      <Tarjeta titulo={esProfesional ? "Me deben" : "Saldo por pagar"} valor={formatCOP(r.saldo_por_pagar)} nota={`Pagado ${formatCOP(r.pagado)}`} />
      <Tarjeta titulo="Liquidadas" valor={formatCOP(r.comisiones_liquidadas)} />
      <Tarjeta titulo="Ajustes" valor={formatCOP(r.ajustes)} />
      {esProfesional ? (
        <Tarjeta titulo="En revisión" valor={formatCOP(r.en_revision)} />
      ) : (
        <Tarjeta titulo="Participación del negocio" valor={formatCOP(r.participacion_negocio ?? 0)} nota={`Cancelados/no-show: ${r.servicios_cancelados}`} />
      )}
      {r.sin_regla > 0 ? <Tarjeta titulo="Sin regla" valor={String(r.sin_regla)} nota="Define una regla de comisión" /> : esProfesional ? null : <Tarjeta titulo="En revisión" valor={formatCOP(r.en_revision)} />}
    </section>
  );
}

const CAMPO = "min-h-10 w-full border-2 border-border bg-bg px-2 text-[13px] text-text";

export function FiltrosForm({
  accion, valores, sedes, equipo, vista,
}: {
  accion: string;
  valores: FiltrosGanancias;
  sedes?: Array<{ id: string; nombre: string }>;
  equipo?: Array<{ id: string; nombre: string }>;
  vista?: string;
}) {
  return (
    <form method="get" action={accion} className="mb-4 grid grid-cols-2 gap-2 border-2 border-border bg-surface p-3 md:grid-cols-4">
      {vista ? <input type="hidden" name="vista" value={vista} /> : null}
      <label className="text-[11px] font-bold uppercase text-text-muted">Período
        <select name="rapido" defaultValue={valores.rapido ?? ""} className={CAMPO}>
          <option value="">Personalizado</option><option value="hoy">Hoy</option><option value="ayer">Ayer</option>
          <option value="semana">Esta semana</option><option value="semana_anterior">Semana anterior</option>
          <option value="mes">Este mes</option><option value="mes_anterior">Mes anterior</option>
        </select>
      </label>
      <label className="text-[11px] font-bold uppercase text-text-muted">Desde
        <input type="date" name="desde" defaultValue={valores.rapido ? "" : valores.desde} className={CAMPO} />
      </label>
      <label className="text-[11px] font-bold uppercase text-text-muted">Hasta
        <input type="date" name="hasta" defaultValue={valores.rapido ? "" : valores.hasta} className={CAMPO} />
      </label>
      <label className="text-[11px] font-bold uppercase text-text-muted">Buscar
        <input type="search" name="q" maxLength={80} defaultValue={valores.q ?? ""} placeholder="Cliente, servicio, profesional, ID…" className={CAMPO} />
      </label>
      {sedes && sedes.length > 1 ? (
        <label className="text-[11px] font-bold uppercase text-text-muted">Sede
          <select name="sede" defaultValue={valores.sede ?? ""} className={CAMPO}>
            <option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      ) : null}
      {equipo && equipo.length > 0 ? (
        <label className="text-[11px] font-bold uppercase text-text-muted">Profesional
          <select name="staff" defaultValue={valores.staff ?? ""} className={CAMPO}>
            <option value="">Todos</option>{equipo.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      ) : null}
      <label className="text-[11px] font-bold uppercase text-text-muted">Comisión
        <select name="estado_comision" defaultValue={valores.estadoComision ?? ""} className={CAMPO}>
          <option value="">Todas</option>
          {Object.entries(ETIQUETA_ESTADO_COMISION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-bold uppercase text-text-muted">Cobro
        <select name="estado_cobro" defaultValue={valores.estadoCobro ?? ""} className={CAMPO}>
          <option value="">Todos</option>
          {Object.entries(ETIQUETA_COBRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-bold uppercase text-text-muted">Liquidación
        <select name="estado_liquidacion" defaultValue={valores.estadoLiquidacion ?? ""} className={CAMPO}>
          <option value="">Todas</option><option value="SIN_LIQUIDAR">Sin liquidar</option><option value="LIQUIDADA">Liquidada</option><option value="PAGADA">Pagada</option>
        </select>
      </label>
      <div className="col-span-2 flex items-end gap-2 md:col-span-4">
        <Button type="submit" size="sm">Aplicar filtros</Button>
        <Link href={vista ? `${accion}?vista=${vista}` : accion} className="text-[12.5px] font-semibold underline">Limpiar</Link>
      </div>
    </form>
  );
}

export function TablaGanancias({
  filas, mostrarProfesional, mostrarParticipacion, accionFila,
}: {
  filas: FilaGanancia[];
  mostrarProfesional: boolean;
  mostrarParticipacion: boolean;
  /** Contenido opcional por fila (p. ej. solicitar revisión del profesional). */
  accionFila?: (f: FilaGanancia) => React.ReactNode;
}) {
  if (filas.length === 0) {
    return <p className="border-2 border-dashed border-border p-6 text-center text-[13px] text-text-muted">No hay registros con estos filtros.</p>;
  }
  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-2 border-border text-left text-[12.5px]">
          <thead className="bg-surface font-mono text-[10.5px] uppercase text-text-muted">
            <tr>
              <th className="p-2">Fecha</th><th className="p-2">Servicio</th><th className="p-2">Cliente</th>
              {mostrarProfesional ? <th className="p-2">Profesional</th> : null}
              <th className="p-2">Sede</th><th className="p-2 text-right">Precio</th><th className="p-2 text-right">Desc.</th>
              <th className="p-2">Base</th><th className="p-2 text-right">%</th><th className="p-2 text-right">Comisión</th>
              {mostrarParticipacion ? <th className="p-2 text-right">Negocio</th> : null}
              <th className="p-2">Cobro</th><th className="p-2">Estado</th>{accionFila ? <th className="p-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-border-subtle align-top">
                <td className="p-2 whitespace-nowrap">{fechaCorta(f.fecha)}</td>
                <td className="p-2">{f.servicio}</td>
                <td className="p-2">{f.cliente ?? "—"}</td>
                {mostrarProfesional ? <td className="p-2">{f.profesional ?? "—"}</td> : null}
                <td className="p-2">{f.sede ?? "—"}</td>
                <td className="p-2 text-right">{formatCOP(f.precio_original)}</td>
                <td className="p-2 text-right">{f.descuento > 0 ? formatCOP(f.descuento) : "—"}</td>
                <td className="p-2">{f.base_tipo === "PRECIO_ORIGINAL" ? "Precio" : f.base_tipo === "NETO" ? "Neto" : "—"}</td>
                <td className="p-2 text-right">{f.pct ?? "—"}</td>
                <td className="p-2 text-right font-bold">{formatCOP(f.comision)}</td>
                {mostrarParticipacion ? <td className="p-2 text-right">{formatCOP(f.participacion_negocio)}</td> : null}
                <td className="p-2">{ETIQUETA_COBRO[f.estado_cobro] ?? f.estado_cobro}</td>
                <td className="p-2"><Badge tone={TONO_COMISION[f.estado_comision] ?? "neutral"}>{ETIQUETA_ESTADO_COMISION[f.estado_comision] ?? f.estado_comision}</Badge></td>
                {accionFila ? <td className="p-2">{accionFila(f)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Móvil: tarjetas */}
      <ul className="grid gap-2 md:hidden">
        {filas.map((f) => (
          <li key={f.id} className="border-2 border-border bg-surface p-3 text-[12.5px]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold text-text">{f.servicio}</p>
                <p className="text-text-muted">{fechaCorta(f.fecha)} · {f.cliente ?? "Sin cliente"}{mostrarProfesional && f.profesional ? ` · ${f.profesional}` : ""}</p>
              </div>
              <Badge tone={TONO_COMISION[f.estado_comision] ?? "neutral"}>{ETIQUETA_ESTADO_COMISION[f.estado_comision] ?? f.estado_comision}</Badge>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <dt className="text-text-muted">Precio</dt><dd className="text-right">{formatCOP(f.precio_original)}</dd>
              <dt className="text-text-muted">Descuento</dt><dd className="text-right">{f.descuento > 0 ? formatCOP(f.descuento) : "—"}</dd>
              <dt className="text-text-muted">Comisión{f.pct != null ? ` (${f.pct}%)` : ""}</dt><dd className="text-right font-bold">{formatCOP(f.comision)}</dd>
              {mostrarParticipacion ? (<><dt className="text-text-muted">Negocio</dt><dd className="text-right">{formatCOP(f.participacion_negocio)}</dd></>) : null}
              <dt className="text-text-muted">Cobro</dt><dd className="text-right">{ETIQUETA_COBRO[f.estado_cobro] ?? f.estado_cobro}</dd>
            </dl>
            {accionFila ? <div className="mt-2">{accionFila(f)}</div> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Paginacion({ total, pagina, base, params }: { total: number; pagina: number; base: string; params: Record<string, string | undefined> }) {
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const url = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-[12.5px]">
      <span className="text-text-muted">{total} registro{total === 1 ? "" : "s"} · página {Math.min(pagina, paginas)} de {paginas}</span>
      <span className="flex gap-3">
        {pagina > 1 ? <Link href={url(pagina - 1)} className="font-semibold underline">Anterior</Link> : null}
        {pagina < paginas ? <Link href={url(pagina + 1)} className="font-semibold underline">Siguiente</Link> : null}
      </span>
    </nav>
  );
}
