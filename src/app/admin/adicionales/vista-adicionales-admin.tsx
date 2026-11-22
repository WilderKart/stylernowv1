"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fechaAdicional } from "@/lib/adicionales/tipos";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  accionLoteAdmin,
  activarManualAdmin,
  decidirReembolsoAdmin,
  detalleLoteAdmin,
  guardarConfigAdicionales,
  guardarPrecioAdicional,
  resolverRevisionAdmin,
  solicitarReembolsoAdmin,
  type DatosConfigAdicionales,
  type DetalleLote,
  type FilaLote,
  type Reembolso,
  type Revision,
} from "./actions";

type Aviso = { tipo: "ok" | "error"; texto: string } | null;
type Datos = { config: DatosConfigAdicionales; lotes: { total: number; filas: FilaLote[] }; reembolsos: Reembolso[]; revisiones: Revision[] };
type Filtros = { estado?: string; negocio?: string; texto?: string; vence?: string };

function Mensaje({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return (
    <p role={aviso.tipo === "error" ? "alert" : "status"} className={`border-2 p-3 text-[13px] font-bold ${aviso.tipo === "error" ? "border-danger text-danger" : "border-border"}`}>
      {aviso.texto}
    </p>
  );
}

function useAccion() {
  const router = useRouter();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendiente, iniciar] = useTransition();
  function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, despues?: () => void) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return setAviso({ tipo: "error", texto: r.error ?? "Error" });
      setAviso({ tipo: "ok", texto: ok });
      despues?.();
      router.refresh();
    });
  }
  return { aviso, pendiente, ejecutar };
}

const tono = (e: string): "success" | "danger" | "accent" | "neutral" =>
  e === "ACTIVO" ? "success" : ["SUSPENDIDO", "REEMBOLSADO", "EXPIRADO_SIN_PAGO"].includes(e) ? "danger" : ["EN_GRACIA", "PROXIMO_A_RENOVAR", "PAGO_PENDIENTE", "CHECKOUT_INICIADO"].includes(e) ? "accent" : "neutral";

// ── Configuración ──────────────────────────────────────────────────────────────────────────
function SeccionConfig({ d }: { d: DatosConfigAdicionales }) {
  const c = d.config;
  const [v, setV] = useState({
    habilitado: c.habilitado,
    maxNegocio: String(c.max_por_negocio),
    maxLote: String(c.max_por_lote),
    gracia: String(c.gracia_dias),
    avisos: c.avisos_dias_antes.join(", "),
    checkout: String(c.checkout_expira_horas),
    pendiente: String(c.pago_pendiente_expira_dias),
    manualMax: String(c.activacion_manual_max_dias),
    motivo: "",
  });
  const { aviso, pendiente, ejecutar } = useAccion();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Reglas generales</h2>
      <p className="sn-meta">
        El periodo es de {c.periodo_dias} días desde el pago confirmado (hora de Bogotá). El máximo por lote es una PROPUESTA inicial (50) pendiente de confirmar. Cambiar
        estos valores no altera lotes ya contratados salvo la gracia y los avisos de los periodos por venir.
      </p>
      <label className="flex items-center gap-2 text-[13px] font-bold">
        <input type="checkbox" className="size-4" checked={v.habilitado} onChange={(e) => setV({ ...v, habilitado: e.target.checked })} /> Contratación habilitada
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Máximo por establecimiento" type="number" value={v.maxNegocio} onChange={(e) => setV({ ...v, maxNegocio: e.target.value })} />
        <Input label="Máximo por contratación (lote)" type="number" value={v.maxLote} onChange={(e) => setV({ ...v, maxLote: e.target.value })} />
        <Input label="Días de gracia" type="number" value={v.gracia} onChange={(e) => setV({ ...v, gracia: e.target.value })} />
        <Input label="Avisos (días antes, separados por coma)" value={v.avisos} onChange={(e) => setV({ ...v, avisos: e.target.value })} />
        <Input label="Checkout sin pago expira (horas)" type="number" value={v.checkout} onChange={(e) => setV({ ...v, checkout: e.target.value })} />
        <Input label="Pago pendiente expira (días)" type="number" value={v.pendiente} onChange={(e) => setV({ ...v, pendiente: e.target.value })} />
        <Input label="Vigencia máxima de una excepción (días)" type="number" value={v.manualMax} onChange={(e) => setV({ ...v, manualMax: e.target.value })} />
      </div>
      <Input label="Motivo del cambio" value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} />
      <Mensaje aviso={aviso} />
      <Button
        loading={pendiente}
        onClick={() =>
          ejecutar(
            () =>
              guardarConfigAdicionales({
                habilitado: v.habilitado,
                max_por_negocio: Number(v.maxNegocio),
                max_por_lote: Number(v.maxLote),
                gracia_dias: Number(v.gracia),
                avisos_dias_antes: v.avisos.split(",").map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0),
                checkout_expira_horas: Number(v.checkout),
                pago_pendiente_expira_dias: Number(v.pendiente),
                activacion_manual_max_dias: Number(v.manualMax),
                motivo: v.motivo,
              }),
            "Configuración guardada."
          )
        }
      >
        Guardar reglas
      </Button>
    </Card>
  );
}

function FilaPrecio({ pais, plan, actual }: { pais: string; plan: string; actual: number | null }) {
  const [precio, setPrecio] = useState(actual === null ? "" : String(actual));
  const [motivo, setMotivo] = useState("");
  const { aviso, pendiente, ejecutar } = useAccion();
  return (
    <div className="flex flex-col gap-2 border-2 border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <span className="min-w-24 font-display text-[15px] font-black uppercase">
          {plan} · {pais}
        </span>
        <div className="w-36">
          <Input label="Precio mensual (COP)" type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div className="min-w-48 flex-1">
          <Input label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <Button
          size="sm"
          loading={pendiente}
          onClick={() => ejecutar(() => guardarPrecioAdicional({ pais, plan, precio: Number(precio), motivo }), "Precio guardado. Los lotes vigentes conservan el suyo.", () => setMotivo(""))}
        >
          Guardar
        </Button>
      </div>
      <Mensaje aviso={aviso} />
    </div>
  );
}

function SeccionPrecios({ d }: { d: DatosConfigAdicionales }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Precio por plan</h2>
      <p className="sn-meta">Un precio por plan y país (hoy 51.900 COP para los cuatro planes en Colombia). Un país sin precio no puede contratar. Sin descuento Founder en adicionales.</p>
      {d.paises
        .filter((p) => d.precios.some((x) => x.pais_codigo === p) || p === "CO")
        .flatMap((pais) =>
          d.planes.map((pl) => {
            const fila = d.precios.find((x) => x.pais_codigo === pais && x.plan_codigo === pl.codigo);
            return <FilaPrecio key={`${pais}-${pl.codigo}`} pais={pais} plan={pl.codigo} actual={fila ? Number(fila.precio_mensual) : null} />;
          })
        )}
    </Card>
  );
}

function SeccionEstados({ d }: { d: DatosConfigAdicionales }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Estados y transiciones (máquina única)</h2>
      <p className="sn-meta">Solo la base cambia el estado de un lote; esta lista es de consulta. Mismo vocabulario en el panel del propietario, el CRM y los webhooks.</p>
      <div className="flex flex-wrap gap-1.5">
        {d.estados.map((e) => (
          <Badge key={e.codigo} tone={tono(e.codigo)}>
            {e.etiqueta_es}
            {e.terminal ? " ·final" : ""}
          </Badge>
        ))}
      </div>
      <ul className="grid gap-1 text-[12px] text-text-muted sm:grid-cols-2">
        {d.transiciones.map((t) => (
          <li key={`${t.desde}-${t.hacia}`} className="font-mono">
            {t.desde} → {t.hacia} <span className="text-text-faint">({t.actores.join("/")})</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Lotes ─────────────────────────────────────────────────────────────────────────────────────
function DetalleYAcciones({ l, onCerrar }: { l: FilaLote; onCerrar: () => void }) {
  const [det, setDet] = useState<DetalleLote | null>(null);
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState("30");
  const [cantidad, setCantidad] = useState(String(l.cantidad));
  const { aviso, pendiente, ejecutar } = useAccion();
  const [cargando, iniciar] = useTransition();

  function cargar() {
    iniciar(async () => {
      const r = await detalleLoteAdmin(l.id);
      if (r.ok) setDet(r.data);
    });
  }
  return (
    <Card className="flex flex-col gap-3 border-accent p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[16px] font-black uppercase">
          {l.negocio} · {l.cantidad} × {formatCOP(l.precio_unitario)}
        </h3>
        <Button size="sm" variant="ghost" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
      <Input label="Motivo (obligatorio para cualquier acción)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" variant="secondary" loading={pendiente} onClick={() => ejecutar(() => accionLoteAdmin({ loteId: l.id, accion: "SUSPENDER", motivo }), "Lote suspendido.")}>
          Suspender
        </Button>
        <div className="flex items-end gap-2">
          <div className="w-24">
            <Input label="Días" type="number" value={dias} onChange={(e) => setDias(e.target.value)} />
          </div>
          <Button size="sm" loading={pendiente} onClick={() => ejecutar(() => accionLoteAdmin({ loteId: l.id, accion: "REACTIVAR", motivo, dias: Number(dias) }), "Lote reactivado con la vigencia indicada.")}>
            Reactivar
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-24">
            <Input label="Cantidad" type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <Button size="sm" variant="secondary" loading={pendiente} onClick={() => ejecutar(() => accionLoteAdmin({ loteId: l.id, accion: "AJUSTAR", motivo, cantidad: Number(cantidad) }), "Cantidad ajustada (sin cobro).")}>
            Ajustar
          </Button>
        </div>
        <Button size="sm" variant="danger" loading={pendiente} onClick={() => ejecutar(() => accionLoteAdmin({ loteId: l.id, accion: "CANCELAR", motivo }), "Lote cancelado.")}>
          Cancelar
        </Button>
        <Button size="sm" variant="ghost" loading={cargando} onClick={cargar}>
          Ver historial y pagos
        </Button>
      </div>
      <Mensaje aviso={aviso} />
      {det ? (
        <div className="flex flex-col gap-3 text-[12.5px]">
          <div>
            <h4 className="sn-meta">Pagos (referencias de Mercado Pago)</h4>
            <ul>
              {det.cobros.map((c) => (
                <li key={c.id} className="font-mono">
                  P{c.periodo_n} · {formatCOP(c.monto)} · {c.estado} · MP {c.mp_payment_id ?? "—"} · pago {c.pago_id.slice(0, 8)}
                </li>
              ))}
              {det.cobros.length === 0 ? <li>Sin pagos.</li> : null}
            </ul>
          </div>
          <div>
            <h4 className="sn-meta">Historial</h4>
            <ul>
              {det.historial.map((h) => (
                <li key={h.id} className="font-mono">
                  {fechaAdicional(h.created_at)} · {h.evento} · {h.estado_antes ?? "—"}→{h.estado_despues ?? "—"} · {h.actor_tipo}
                  {h.motivo ? ` · «${h.motivo}»` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function SeccionLotes({ d, filtros }: { d: Datos; filtros: Filtros }) {
  const router = useRouter();
  const [f, setF] = useState({ estado: filtros.estado ?? "", texto: filtros.texto ?? "", vence: filtros.vence ?? "" });
  const [sel, setSel] = useState<FilaLote | null>(null);
  function buscar() {
    const q = new URLSearchParams();
    if (f.estado) q.set("estado", f.estado);
    if (f.texto) q.set("texto", f.texto);
    if (f.vence) q.set("vence", f.vence);
    router.push(`/admin/adicionales${q.size ? `?${q}` : ""}`);
  }
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Lotes contratados ({d.lotes.total})</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-2 font-mono text-xs font-bold uppercase">
          Estado
          <select className="min-h-12 border-2 border-border bg-bg px-3 text-[14px] normal-case" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            <option value="">Todos</option>
            {d.config.estados.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {e.etiqueta_es}
              </option>
            ))}
          </select>
        </label>
        <Input label="Negocio" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
        <Input label="Vence antes de" type="date" value={f.vence} onChange={(e) => setF({ ...f, vence: e.target.value })} />
        <Button size="sm" onClick={buscar}>
          Filtrar
        </Button>
      </div>
      {sel ? <DetalleYAcciones l={sel} onCerrar={() => setSel(null)} /> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b-2 border-border font-mono text-[11px] uppercase">
              <th className="p-2">Negocio</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Cant.</th>
              <th className="p-2">Precio</th>
              <th className="p-2">Total</th>
              <th className="p-2">Vence</th>
              <th className="p-2">Pagos</th>
              <th className="p-2">MP</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {d.lotes.filas.map((l) => (
              <tr key={l.id} className="border-b border-border align-top">
                <td className="p-2 font-bold">{l.negocio}</td>
                <td className="p-2">
                  <Badge tone={tono(l.estado)}>{l.estado.replaceAll("_", " ").toLowerCase()}</Badge>
                  {l.origen === "MANUAL_SUPERADMIN" ? <span className="sn-meta block">manual {l.manual_tipo?.toLowerCase()}</span> : null}
                  {l.revisiones_abiertas > 0 ? <span className="sn-meta block text-danger">{l.revisiones_abiertas} en revisión</span> : null}
                </td>
                <td className="p-2">{l.cantidad}</td>
                <td className="p-2">{formatCOP(l.precio_unitario)}</td>
                <td className="p-2">{formatCOP(l.total)}</td>
                <td className="p-2">
                  {fechaAdicional(l.vigente_hasta)}
                  {l.estado === "EN_GRACIA" ? <span className="sn-meta block">gracia {fechaAdicional(l.gracia_fin)}</span> : null}
                </td>
                <td className="p-2">
                  {l.cobros}
                  {l.cobros_fallidos > 0 ? <span className="sn-meta block">{l.cobros_fallidos} fallidos</span> : null}
                </td>
                <td className="p-2 font-mono">{l.ultimo_mp_payment_id ?? "—"}</td>
                <td className="p-2">
                  <Button size="sm" variant="secondary" onClick={() => setSel(l)}>
                    Abrir
                  </Button>
                </td>
              </tr>
            ))}
            {d.lotes.filas.length === 0 ? (
              <tr>
                <td className="p-4 text-text-muted" colSpan={9}>
                  No hay lotes con esos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Activación manual ─────────────────────────────────────────────────────────────────────────
function SeccionManual({ maxDias }: { maxDias: number }) {
  const [v, setV] = useState({ negocio: "", cantidad: "1", dias: "30", tipo: "CORTESIA" as "CORTESIA" | "TRANSFERENCIA" | "CONTINGENCIA_PASARELA", referencia: "", motivo: "" });
  const { aviso, pendiente, ejecutar } = useAccion();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Activación manual de cupo (excepción)</h2>
      <p className="sn-meta">Sin cobro. Queda con responsable, motivo y vigencia obligatoria (máximo {maxDias} días); al vencer se cancela sola. La transferencia exige referencia.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="ID del negocio" value={v.negocio} onChange={(e) => setV({ ...v, negocio: e.target.value })} />
        <Input label="Cantidad" type="number" value={v.cantidad} onChange={(e) => setV({ ...v, cantidad: e.target.value })} />
        <Input label="Vigencia (días)" type="number" value={v.dias} onChange={(e) => setV({ ...v, dias: e.target.value })} />
        <label className="flex flex-col gap-2 font-mono text-xs font-bold uppercase">
          Tipo
          <select className="min-h-12 border-2 border-border bg-bg px-3 text-[14px] normal-case" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as typeof v.tipo })}>
            <option value="CORTESIA">Cortesía</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CONTINGENCIA_PASARELA">Contingencia de pasarela</option>
          </select>
        </label>
        <Input label="Referencia" value={v.referencia} onChange={(e) => setV({ ...v, referencia: e.target.value })} />
        <Input label="Motivo" value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} />
      </div>
      <Mensaje aviso={aviso} />
      <Button loading={pendiente} onClick={() => ejecutar(() => activarManualAdmin({ negocioId: v.negocio.trim(), cantidad: Number(v.cantidad), dias: Number(v.dias), tipo: v.tipo, motivo: v.motivo, referencia: v.referencia || undefined }), "Cupo activado manualmente.")}>
        Activar cupo
      </Button>
    </Card>
  );
}

// ── Reembolsos y revisión de pagos ────────────────────────────────────────────────────────────────
function FilaReembolso({ r }: { r: Reembolso }) {
  const [motivo, setMotivo] = useState("");
  const [ref, setRef] = useState("");
  const [cerrar, setCerrar] = useState(false);
  const { aviso, pendiente, ejecutar } = useAccion();
  const dec = (decision: "EN_REVISION" | "APROBADO" | "RECHAZADO" | "EJECUTADO_MANUAL", ok: string) =>
    ejecutar(() => decidirReembolsoAdmin({ id: r.id, decision, motivo, referencia: ref || undefined, cerrarLote: cerrar }), ok);
  const abierto = ["SOLICITADO", "EN_REVISION", "APROBADO"].includes(r.estado);
  return (
    <li className="flex flex-col gap-2 border-2 border-border p-3 text-[12.5px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">
          {r.negocio} · {formatCOP(r.monto)} · {r.causa.replaceAll("_", " ").toLowerCase()}
        </span>
        <Badge tone={r.estado === "EJECUTADO_MANUAL" ? "success" : r.estado === "RECHAZADO" ? "danger" : "accent"}>{r.estado.replaceAll("_", " ").toLowerCase()}</Badge>
      </div>
      {r.detalle ? <span className="text-text-muted">{r.detalle}</span> : null}
      {r.decision_motivo ? <span className="sn-meta">Decisión: {r.decision_motivo}</span> : null}
      {r.referencia_ejecucion ? <span className="sn-meta">Referencia de ejecución: {r.referencia_ejecucion}</span> : null}
      {abierto ? (
        <>
          <Input label="Motivo de la decisión" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex flex-wrap items-end gap-2">
            {r.estado === "SOLICITADO" ? (
              <Button size="sm" variant="secondary" loading={pendiente} onClick={() => dec("EN_REVISION", "Reembolso en revisión.")}>
                En revisión
              </Button>
            ) : null}
            {r.estado !== "APROBADO" ? (
              <>
                <Button size="sm" loading={pendiente} onClick={() => dec("APROBADO", "Reembolso aprobado.")}>
                  Aprobar
                </Button>
                <Button size="sm" variant="danger" loading={pendiente} onClick={() => dec("RECHAZADO", "Reembolso rechazado.")}>
                  Rechazar
                </Button>
              </>
            ) : (
              <>
                <div className="min-w-48">
                  <Input label="ID del reembolso en Mercado Pago" value={ref} onChange={(e) => setRef(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" className="size-4" checked={cerrar} onChange={(e) => setCerrar(e.target.checked)} /> Cerrar el lote como reembolsado
                </label>
                <Button size="sm" loading={pendiente} onClick={() => dec("EJECUTADO_MANUAL", "Ejecución manual registrada.")}>
                  Registrar ejecución manual
                </Button>
              </>
            )}
          </div>
          <Mensaje aviso={aviso} />
        </>
      ) : null}
    </li>
  );
}

function SeccionReembolsos({ d }: { d: Datos }) {
  const [v, setV] = useState({ pago: "", causa: "COBRO_DUPLICADO", detalle: "", motivo: "" });
  const { aviso, pendiente, ejecutar } = useAccion();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Reembolsos (solo registro)</h2>
      <p className="sn-meta">
        No hay reembolsos automáticos ni al cancelar. Aquí se registra la solicitud, la decisión con motivo y su estado. La devolución real se hace en el panel de Mercado Pago y se anota con
        su referencia: este sistema NO ejecuta reembolsos de adicionales.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="ID del pago (STAFF_EXTRA)" value={v.pago} onChange={(e) => setV({ ...v, pago: e.target.value })} />
        <label className="flex flex-col gap-2 font-mono text-xs font-bold uppercase">
          Causa
          <select className="min-h-12 border-2 border-border bg-bg px-3 text-[14px] normal-case" value={v.causa} onChange={(e) => setV({ ...v, causa: e.target.value })}>
            <option value="COBRO_DUPLICADO">Cobro duplicado</option>
            <option value="COBRO_INCORRECTO">Cobro incorrecto</option>
            <option value="ERROR_TECNICO">Error técnico</option>
            <option value="PAGO_NO_RECONOCIDO">Pago no reconocido</option>
            <option value="OBLIGACION_LEGAL">Obligación legal</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <Input label="Detalle" value={v.detalle} onChange={(e) => setV({ ...v, detalle: e.target.value })} />
        <Input label="Motivo" value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} />
      </div>
      <Mensaje aviso={aviso} />
      <Button loading={pendiente} onClick={() => ejecutar(() => solicitarReembolsoAdmin({ pagoId: v.pago.trim(), causa: v.causa, detalle: v.detalle, motivo: v.motivo }), "Solicitud registrada.")}>
        Registrar solicitud
      </Button>
      <ul className="flex flex-col gap-2">
        {d.reembolsos.length === 0 ? <li className="sn-meta">Sin solicitudes.</li> : null}
        {d.reembolsos.map((r) => (
          <FilaReembolso key={r.id} r={r} />
        ))}
      </ul>
    </Card>
  );
}

function FilaRevision({ r }: { r: Revision }) {
  const [resolucion, setResolucion] = useState("");
  const [motivo, setMotivo] = useState("");
  const { aviso, pendiente, ejecutar } = useAccion();
  return (
    <li className="flex flex-col gap-2 border-2 border-border p-3 text-[12.5px]">
      <span className="font-bold">
        {r.negocio ?? "—"} · {formatCOP(Number(r.pago_monto))} · {r.motivo.replaceAll("_", " ").toLowerCase()}
      </span>
      <span className="sn-meta font-mono">
        pago {r.pago_id.slice(0, 8)} ({r.pago_estado}) · MP {String(r.detalle?.mp_ref ?? "—")} · {fechaAdicional(r.created_at)}
      </span>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="Resolución" value={resolucion} onChange={(e) => setResolucion(e.target.value)} />
        <Input label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <Mensaje aviso={aviso} />
      <div>
        <Button size="sm" variant="secondary" loading={pendiente} onClick={() => ejecutar(() => resolverRevisionAdmin({ id: r.id, resolucion, motivo }), "Revisión resuelta.")}>
          Marcar resuelta
        </Button>
      </div>
    </li>
  );
}

function SeccionRevision({ d }: { d: Datos }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Pagos en revisión ({d.revisiones.length})</h2>
      <p className="sn-meta">
        Pagos que no cuadran con su lote (importe, lote ajeno, duplicado, tardío…). No activaron nada ni se reembolsaron solos. Decide aquí: activa un cupo con excepción manual, registra un reembolso o
        resuelve sin acción.
      </p>
      <ul className="flex flex-col gap-2">
        {d.revisiones.length === 0 ? <li className="sn-meta">Nada pendiente.</li> : null}
        {d.revisiones.map((r) => (
          <FilaRevision key={r.id} r={r} />
        ))}
      </ul>
    </Card>
  );
}

export function VistaAdicionalesAdmin({ datos, filtros }: { datos: Datos; filtros: Filtros }) {
  return (
    <div className="flex flex-col gap-6">
      <SeccionPrecios d={datos.config} />
      <SeccionConfig d={datos.config} />
      <SeccionLotes d={datos} filtros={filtros} />
      <SeccionManual maxDias={datos.config.config.activacion_manual_max_dias} />
      <SeccionRevision d={datos} />
      <SeccionReembolsos d={datos} />
      <SeccionEstados d={datos.config} />
    </div>
  );
}
