"use client";

import { useTextos } from "@/components/panel/terminologia-contexto";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ETIQUETA_ESTADO,
  fechaAdicional,
  type Cotizacion,
  type LoteAdicional,
  type PanelAdicionales,
} from "@/lib/adicionales/tipos";
import { formatCOP } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  actualizarEstadoAdicionales,
  cancelarRenovacionAdicional,
  contratarAdicionales,
  cotizarAdicionales,
  renovarAdicional,
} from "./actions";

type Aviso = { tipo: "ok" | "error"; texto: string } | null;

const T0 = {
  capacidad: "Capacidad de profesionales",
  incluidos: "Incluidos en tu plan",
  adicionales: "Adicionales activos",
  enGracia: "Adicionales en gracia",
  suspendidos: "Adicionales suspendidos",
  usados: "Cupos usados",
  exceso: "Exceso",
  limite: "Tu tope hoy",
  disponibles: "Disponibles",
  agregar: "Agregar barberos adicionales",
  agregarAyuda:
    "Cada barbero adicional cuesta lo mismo en todos los planes. Pagas por Mercado Pago, sin tarjeta guardada ni cobros automáticos: tú decides cuándo renovar.",
  cantidad: "¿Cuántos barberos quieres agregar?",
  verDetalle: "Ver detalle",
  confirmar: "Confirmo el detalle y las condiciones",
  pagar: "Pagar con Mercado Pago",
  volver: "Cambiar cantidad",
  tusGrupos: "Tus contrataciones",
  ninguno: "Todavía no has contratado barberos adicionales.",
  renovar: "Renovar",
  cancelarRenov: "Cancelar renovación",
  verPagos: "Pagos de este grupo",
  actualizar: "Actualizar estado",
  esperando: "Confirmando el pago con Mercado Pago…",
  condicionesTitulo: "Condiciones",
};

function Mensaje({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return (
    <p role={aviso.tipo === "error" ? "alert" : "status"} className={`border-2 p-3 text-[13px] font-bold ${aviso.tipo === "error" ? "border-danger text-danger" : "border-border"}`}>
      {aviso.texto}
    </p>
  );
}

function toneEstado(e: LoteAdicional["estado"]): "success" | "danger" | "accent" | "neutral" {
  if (e === "ACTIVO") return "success";
  if (e === "SUSPENDIDO" || e === "REEMBOLSADO" || e === "EXPIRADO_SIN_PAGO") return "danger";
  if (e === "EN_GRACIA" || e === "PROXIMO_A_RENOVAR" || e === "PAGO_PENDIENTE" || e === "CHECKOUT_INICIADO") return "accent";
  return "neutral";
}

function Dato({ etiqueta, valor, resaltar }: { etiqueta: string; valor: React.ReactNode; resaltar?: boolean }) {
  return (
    <div className={`border-2 p-3 ${resaltar ? "border-danger" : "border-border"}`}>
      <span className="sn-meta block">{etiqueta}</span>
      <span className="font-display text-[22px] font-black tabular-nums">{valor}</span>
    </div>
  );
}

function Condiciones({ c }: { c: Pick<Cotizacion, "periodo_dias" | "gracia_dias"> }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-text-muted">
      <li>El periodo es de {c.periodo_dias} días, contados desde que Mercado Pago confirma tu pago. No se renueva solo.</li>
      <li>Te avisamos antes del vencimiento. Si vence, tienes {c.gracia_dias} días de gracia para renovar.</li>
      <li>
        Si no renuevas al terminar la gracia, suspendemos solo el cupo adicional. No eliminamos profesionales, citas, historial, evidencias ni datos. Un
        cupo suspendido se reactiva al pagar.
      </li>
      <li>Cancelar la renovación futura no reembolsa el periodo ya pagado: conservas el cupo hasta el vencimiento.</li>
      <li>No hay reembolsos automáticos. Si te cobramos de más o dos veces, escríbenos y lo revisamos de forma individual.</li>
      <li>Un cambio de precio posterior no afecta los grupos que ya contrataste.</li>
    </ul>
  );
}

function TarjetaLote({ l, ocupado, onRenovar, onCancelar }: { l: LoteAdicional; ocupado: boolean; onRenovar: (id: string) => void; onCancelar: (id: string) => void }) {
  const T = useTextos(T0);
  const [verPagos, setVerPagos] = useState(false);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-[18px] font-black uppercase">
          {l.cantidad} {l.cantidad === 1 ? "barbero" : "barberos"}
        </span>
        <Badge tone={toneEstado(l.estado)}>{ETIQUETA_ESTADO[l.estado]}</Badge>
      </div>
      <div className="grid gap-2 text-[13px] sm:grid-cols-2">
        <span>
          <span className="sn-meta block">Precio por barbero (congelado)</span>
          {formatCOP(l.precio_unitario)} / mes
        </span>
        <span>
          <span className="sn-meta block">Total del periodo</span>
          {formatCOP(l.total)}
        </span>
        <span>
          <span className="sn-meta block">Vigente hasta</span>
          {fechaAdicional(l.vigente_hasta)}
          {l.dias_para_vencer !== null && l.aporta_cupo ? ` · en ${l.dias_para_vencer} día(s)` : ""}
        </span>
        {l.estado === "EN_GRACIA" ? (
          <span>
            <span className="sn-meta block">Gracia hasta</span>
            {fechaAdicional(l.gracia_fin)}
          </span>
        ) : (
          <span>
            <span className="sn-meta block">Contratado</span>
            {fechaAdicional(l.contratado_at)}
          </span>
        )}
      </div>
      {l.estado === "SUSPENDIDO" ? (
        <p className="text-[12.5px] text-text-muted">Este cupo está suspendido. Nadie fue eliminado: renueva para reactivarlo.</p>
      ) : null}
      {l.cancelar_renovacion && l.aporta_cupo ? (
        <p className="text-[12.5px] text-text-muted">Cancelaste la renovación: conservas este cupo hasta el {fechaAdicional(l.vigente_hasta)}.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {l.puede_renovar ? (
          <Button size="sm" loading={ocupado} onClick={() => onRenovar(l.id)}>
            {T.renovar} · {formatCOP(l.total)}
          </Button>
        ) : null}
        {l.puede_cancelar && !l.cancelar_renovacion ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={ocupado}
            onClick={() => onCancelar(l.id)}
          >
            {T.cancelarRenov}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => setVerPagos((v) => !v)}>
          {T.verPagos}
        </Button>
      </div>
      {verPagos ? (
        <ul className="flex flex-col gap-1.5">
          {l.cobros.length === 0 ? <li className="sn-meta">Sin pagos todavía.</li> : null}
          {l.cobros.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-border p-2 text-[12.5px]">
              <span>
                Periodo {c.periodo_n} · {formatCOP(c.monto)} · {fechaAdicional(c.creado_at)}
              </span>
              <Badge tone={c.estado === "APROBADO" ? "success" : c.estado === "PENDIENTE" ? "accent" : "danger"}>{c.estado.toLowerCase()}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function VistaAdicionales({ negocioId, inicial }: { negocioId: string; inicial: PanelAdicionales }) {
  const T = useTextos(T0);
  const params = useSearchParams();
  const [panel, setPanel] = useState(inicial);
  const [cantidad, setCantidad] = useState("1");
  const [cot, setCot] = useState<Cotizacion | null>(null);
  const [acepto, setAcepto] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendiente, iniciar] = useTransition();
  const [ocupadoLote, setOcupadoLote] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loteCancelar, setLoteCancelar] = useState<string | null>(null);
  const [esperando, setEsperando] = useState(false);
  const intentos = useRef(0);

  const refrescar = useCallback(async () => {
    const r = await actualizarEstadoAdicionales(negocioId);
    if (r.ok) setPanel(r.data);
    return r;
  }, [negocioId]);

  // Retorno de Mercado Pago: el navegador NO confirma nada; se reconsulta el estado real unas veces.
  useEffect(() => {
    if (!esperando) return;
    let activo = true;
    async function ciclo() {
      const r = await refrescar();
      intentos.current += 1;
      const quedaPendiente = r.ok && r.data.lotes.some((l) => l.pago_pendiente_id);
      if (!activo) return;
      if (!quedaPendiente || intentos.current >= 6) return setEsperando(false);
      setTimeout(() => activo && void ciclo(), 4000);
    }
    void ciclo();
    return () => {
      activo = false;
    };
  }, [esperando, refrescar]);

  const cap = panel.capacidad;
  const precio = "error" in panel.precio_actual ? null : panel.precio_actual;

  function verDetalle() {
    setAviso(null);
    setAcepto(false);
    iniciar(async () => {
      const r = await cotizarAdicionales(negocioId, Number(cantidad));
      if (!r.ok) return setAviso({ tipo: "error", texto: r.error });
      setCot(r.data);
    });
  }

  function pagar() {
    if (!cot) return;
    setAviso(null);
    iniciar(async () => {
      const r = await contratarAdicionales({ negocioId, cantidad: cot.cantidad, totalEsperado: cot.total });
      if (!r.ok) {
        setCot(null);
        return setAviso({ tipo: "error", texto: r.error });
      }
      window.location.assign(r.data.url);
    });
  }

  function renovar(id: string) {
    setAviso(null);
    setOcupadoLote(id);
    iniciar(async () => {
      const r = await renovarAdicional(id);
      setOcupadoLote(null);
      if (!r.ok) return setAviso({ tipo: "error", texto: r.error });
      window.location.assign(r.data.url);
    });
  }

  function cancelarRenovacion(id: string) {
    setLoteCancelar(id);
    setConfirmOpen(true);
  }

  const visibles = panel.lotes.filter((l) => l.estado !== "EXPIRADO_SIN_PAGO");

  return (
    <div className="flex flex-col gap-5">
      {confirmOpen && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onOpenChange={setConfirmOpen}
          onConfirm={() => {
            const id = loteCancelar;
            setLoteCancelar(null);
            setConfirmOpen(false);
            if (!id) return;
            setAviso(null);
            setOcupadoLote(id);
            iniciar(async () => {
              const r = await cancelarRenovacionAdicional(id);
              setOcupadoLote(null);
              if (!r.ok) return setAviso({ tipo: "error", texto: r.error });
              setAviso({ tipo: "ok", texto: "Listo: no se renovará. Conservas el cupo hasta el vencimiento." });
              await refrescar();
            });
          }}
          onCancel={() => {
            setLoteCancelar(null);
            setConfirmOpen(false);
          }}
          title="Confirmar cancelación"
          description="¿Cancelar la renovación? Conservas el cupo ya pagado hasta su vencimiento y no se reembolsa el periodo pagado."
          confirmLabel="Cancelar renovación"
          cancelLabel="Cancelar"
        />
      )}

      {aviso ? (
        <Mensaje aviso={aviso} />
      ) : null}

      {cap ? (
        <section aria-labelledby="cap-titulo" className="flex flex-col gap-3">
          <h2 id="cap-titulo" className="section">
            {T.capacidad}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dato etiqueta={T.incluidos} valor={cap.tope_plan ?? "—"} />
            <Dato etiqueta={T.adicionales} valor={cap.adicionales_activos} />
            <Dato etiqueta={T.usados} valor={cap.ocupados} />
            <Dato etiqueta={T.limite} valor={cap.limite ?? "Sin tope"} />
            <Dato etiqueta={T.enGracia} valor={cap.adicionales_en_gracia} />
            <Dato etiqueta={T.suspendidos} valor={cap.adicionales_suspendidos} />
            <Dato etiqueta={T.disponibles} valor={cap.disponibles ?? "—"} />
            <Dato etiqueta={T.exceso} valor={cap.exceso} resaltar={cap.exceso > 0} />
          </div>
          {cap.exceso > 0 ? (
            <Card role="status" className="border-accent shadow-[4px_4px_0_0_var(--color-ink,#111)]">
              <p className="font-display text-[15px] font-bold uppercase text-text">Tu equipo supera tu capacidad</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                Tienes {cap.exceso} {cap.exceso === 1 ? "profesional" : "profesionales"} por encima de tu tope. No retiramos a nadie, pero no podrás sumar ni invitar a más hasta
                regularizar {cap.exceso} {cap.exceso === 1 ? "cupo" : "cupos"} renueva o contrata barberos adicionales, o actualiza tu plan.
              </p>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="agregar-titulo" className="flex flex-col gap-3">
        <h2 id="agregar-titulo" className="section">
          {T.agregar}
        </h2>
        <p className="sn-meta">{T.agregarAyuda}</p>
        {!panel.config.habilitado ? (
          <p className="text-[13px] text-text-muted">Los barberos adicionales no están disponibles por ahora.</p>
        ) : !cot ? (
          <Card className="flex flex-col gap-3 p-4">
            {precio ? (
              <p className="text-[13px]">
                Precio por barbero: <b>{formatCOP(precio.precio_unitario)}</b> al mes (plan {precio.plan_codigo}). Máximo {precio.puede_contratar_hasta} en esta compra.
              </p>
            ) : (
              <p className="text-[13px] text-text-muted">{"error" in panel.precio_actual ? "Por ahora no puedes contratar adicionales (revisa que tu plan esté vigente)." : ""}</p>
            )}
            <Input
              label={T.cantidad}
              type="number"
              min={1}
              max={precio?.puede_contratar_hasta ?? panel.config.max_por_lote}
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            <Button loading={pendiente} disabled={!precio || !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1} onClick={verDetalle}>
              {T.verDetalle}
            </Button>
          </Card>
        ) : (
          <Card className="flex flex-col gap-3 p-4" aria-live="polite">
            <h3 className="font-display text-[18px] font-black uppercase">Detalle de tu contratación</h3>
            <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="sn-meta">Cantidad</dt>
                <dd>{cot.cantidad}</dd>
              </div>
              <div>
                <dt className="sn-meta">Precio por barbero</dt>
                <dd>{formatCOP(cot.precio_unitario)} / mes</dd>
              </div>
              <div>
                <dt className="sn-meta">Total a pagar hoy</dt>
                <dd className="font-display text-[22px] font-black">{formatCOP(cot.total)}</dd>
              </div>
              <div>
                <dt className="sn-meta">Periodo</dt>
                <dd>{cot.periodo_dias} días</dd>
              </div>
              <div>
                <dt className="sn-meta">Vence (si pagas hoy)</dt>
                <dd>{fechaAdicional(cot.vence_si_paga_hoy)}</dd>
              </div>
              <div>
                <dt className="sn-meta">Gracia al vencer</dt>
                <dd>
                  {cot.gracia_dias} días (hasta {fechaAdicional(cot.gracia_hasta)})
                </dd>
              </div>
            </dl>
            <h4 className="sn-meta">{T.condicionesTitulo}</h4>
            <Condiciones c={cot} />
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" className="mt-1 size-4" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
              <span>{T.confirmar}</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button loading={pendiente} disabled={!acepto} onClick={pagar}>
                {T.pagar} · {formatCOP(cot.total)}
              </Button>
              <Button variant="secondary" disabled={pendiente} onClick={() => setCot(null)}>
                {T.volver}
              </Button>
            </div>
            <p className="sn-meta">Tu cupo se activa cuando Mercado Pago confirma el pago, no al volver a esta página.</p>
          </Card>
        )}
      </section>
      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">{T.ninguno}</p>
      ) : (
        visibles.map((l) => <TarjetaLote key={l.id} l={l} ocupado={ocupadoLote === l.id} onRenovar={renovar} onCancelar={cancelarRenovacion} />
      ))}
    </div>
  );
}