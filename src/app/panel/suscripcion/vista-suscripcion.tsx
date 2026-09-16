"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cancelarDowngradeProgramado,
  cancelarMiNegocio,
  consultarEstadoUpgrade,
  iniciarUpgrade,
  solicitarDowngrade,
  type MiSuscripcion,
  type PlanCatalogo,
  type PlanCodigo,
} from "./actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  ACTIVA: "success",
  EN_MORA: "accent",
  SUSPENDIDA: "danger",
  CANCELADA: "neutral",
};

const ESTADO_ETIQUETA: Record<string, string> = {
  ACTIVA: "Al día",
  EN_MORA: "En mora",
  SUSPENDIDA: "Suspendida",
  CANCELADA: "Cancelada",
};

export function VistaSuscripcion({
  negocioId,
  suscripcionInicial,
  planes,
}: {
  negocioId: string;
  suscripcionInicial: MiSuscripcion;
  planes: PlanCatalogo[];
}) {
  const router = useRouter();
  const [suscripcion, setSuscripcion] = useState(suscripcionInicial);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagoPendienteId, setPagoPendienteId] = useState<string | null>(null);
  const [urlCheckout, setUrlCheckout] = useState<string | null>(null);

  const planActual = planes.find((p) => p.codigo === suscripcion.planCodigo) ?? null;
  const planesUpgrade = planes.filter(
    (p) => p.precioMensual !== null && planActual?.precioMensual !== null && p.precioMensual! > (planActual?.precioMensual ?? 0)
  );
  const planesDowngrade = planes.filter(
    (p) => p.precioMensual !== null && planActual?.precioMensual !== null && p.precioMensual! < (planActual?.precioMensual ?? 0)
  );

  // Polling simple mientras hay un pago de upgrade pendiente de confirmación de la pasarela.
  useEffect(() => {
    if (!pagoPendienteId) return;
    const intervalo = setInterval(async () => {
      const res = await consultarEstadoUpgrade(pagoPendienteId);
      if (res.pago === "APROBADO") {
        setPagoPendienteId(null);
        window.location.reload();
      } else if (res.pago === "RECHAZADO") {
        setPagoPendienteId(null);
        setError("El pago del upgrade fue rechazado por la pasarela.");
      }
    }, 4000);
    return () => clearInterval(intervalo);
  }, [pagoPendienteId]);

  // Redirección al checkout de Mercado Pago: aislada en un efecto (en vez de
  // mutar `window.location` directamente dentro del handler) para que la
  // regla de pureza de eslint-plugin-react-hooks no la trate como una
  // mutación fuera de lugar durante el render.
  useEffect(() => {
    if (urlCheckout) window.location.href = urlCheckout;
  }, [urlCheckout]);

  async function onUpgrade(planCodigo: PlanCodigo) {
    setProcesando(planCodigo);
    setError(null);
    const res = await iniciarUpgrade(negocioId, planCodigo);
    setProcesando(null);
    if (!res.ok) return setError(res.mensaje);
    setPagoPendienteId(res.pagoId);
    setUrlCheckout(res.url);
  }

  async function onDowngrade(planCodigo: PlanCodigo) {
    if (!confirm(`¿Programar el downgrade a ${planCodigo}? Se hace efectivo al inicio de tu próximo ciclo, el ${new Date(suscripcion.fechaProximoCobro).toLocaleDateString("es-CO")}.`)) return;
    setProcesando(planCodigo);
    setError(null);
    const res = await solicitarDowngrade(negocioId, planCodigo);
    setProcesando(null);
    if (!res.ok) return setError(res.error);
    setSuscripcion((s) => ({ ...s, planCodigoDestino: planCodigo }));
  }

  async function onCancelarDowngrade() {
    setProcesando("cancelar-downgrade");
    setError(null);
    const res = await cancelarDowngradeProgramado(negocioId);
    setProcesando(null);
    if (!res.ok) return setError(res.error);
    setSuscripcion((s) => ({ ...s, planCodigoDestino: null }));
  }

  async function onCancelarNegocio() {
    const motivo = prompt("Motivo de la baja definitiva de tu negocio:");
    if (!motivo) return;
    if (!confirm("¿Dar de baja tu negocio de forma definitiva? Se cancelan tus reservas futuras con reembolso 100% y no se puede revertir.")) return;
    setProcesando("cancelar-negocio");
    setError(null);
    const res = await cancelarMiNegocio(negocioId, motivo);
    setProcesando(null);
    if (!res.ok) return setError(res.error);
    router.push("/panel");
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Mi Plan</h1>
      <p className="mb-6 text-[12px] text-text-faint">
        Upgrade inmediato con cobro prorrateado. Downgrade programado para tu próximo ciclo de facturación.
      </p>

      <Card className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-bold text-text">{planActual?.nombre ?? suscripcion.planCodigo}</p>
            <p className="text-[11.5px] text-text-faint">
              {planActual?.precioMensual !== null && planActual?.precioMensual !== undefined
                ? `${formatCOP(planActual.precioMensual)}/mes`
                : "Personalizado"}
              {" · "}
              Próximo cobro: {new Date(suscripcion.fechaProximoCobro).toLocaleDateString("es-CO")}
            </p>
          </div>
          <Badge tone={ESTADO_TONO[suscripcion.estado] ?? "neutral"}>{ESTADO_ETIQUETA[suscripcion.estado] ?? suscripcion.estado}</Badge>
        </div>

        {suscripcion.estado === "EN_MORA" ? (
          <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[12px] text-text-muted">
            Tu suscripción está en mora. Escribinos desde <Link href="/panel/soporte" className="font-bold text-accent underline">Soporte</Link> para regularizar el pago.
          </p>
        ) : null}
        {suscripcion.estado === "SUSPENDIDA" ? (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] text-danger">
            Tu negocio está suspendido{suscripcion.suspendidoCausa === "IMPAGO" ? " por impago" : ""}. Escribinos desde{" "}
            <Link href="/panel/soporte" className="font-bold underline">Soporte</Link> para resolverlo.
          </p>
        ) : null}

        {suscripcion.planCodigoDestino ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2">
            <p className="text-[12px] text-text-muted">
              Downgrade programado a <b>{suscripcion.planCodigoDestino}</b> el {new Date(suscripcion.fechaProximoCobro).toLocaleDateString("es-CO")}.
            </p>
            <Button size="sm" variant="ghost" loading={procesando === "cancelar-downgrade"} onClick={onCancelarDowngrade}>
              Cancelar
            </Button>
          </div>
        ) : null}
      </Card>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {suscripcion.estado === "ACTIVA" && planesUpgrade.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Upgrade</h2>
          <ul className="flex flex-col gap-2.5">
            {planesUpgrade.map((p) => (
              <li key={p.codigo} className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
                <div>
                  <p className="text-[13.5px] font-bold text-text">{p.nombre}</p>
                  <p className="text-[11.5px] text-text-faint">{p.precioMensual !== null ? `${formatCOP(p.precioMensual)}/mes` : "Personalizado"}</p>
                </div>
                {p.codigo === "ALLFATHER" ? (
                  <Badge tone="neutral">Cotización</Badge>
                ) : (
                  <Button size="sm" loading={procesando === p.codigo} onClick={() => onUpgrade(p.codigo as PlanCodigo)}>
                    Upgrade
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {suscripcion.estado === "ACTIVA" && !suscripcion.planCodigoDestino && planesDowngrade.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Downgrade</h2>
          <ul className="flex flex-col gap-2.5">
            {planesDowngrade.map((p) => (
              <li key={p.codigo} className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
                <div>
                  <p className="text-[13.5px] font-bold text-text">{p.nombre}</p>
                  <p className="text-[11.5px] text-text-faint">{p.precioMensual !== null ? `${formatCOP(p.precioMensual)}/mes` : "Personalizado"}</p>
                </div>
                <Button size="sm" variant="secondary" loading={procesando === p.codigo} onClick={() => onDowngrade(p.codigo as PlanCodigo)}>
                  Programar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(suscripcion.estado === "ACTIVA" || suscripcion.estado === "SUSPENDIDA") ? (
        <section>
          <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Zona de riesgo</h2>
          <Card>
            <p className="mb-3 text-[12px] text-text-faint">
              Dar de baja tu negocio es definitivo. Tus reservas futuras se cancelan con reembolso del 100% y no podés reactivarlo — para volver a operar necesitás un alta nueva.
            </p>
            <Button size="sm" variant="danger" loading={procesando === "cancelar-negocio"} onClick={onCancelarNegocio}>
              Dar de baja mi negocio
            </Button>
          </Card>
        </section>
      ) : null}
    </main>
  );
}
