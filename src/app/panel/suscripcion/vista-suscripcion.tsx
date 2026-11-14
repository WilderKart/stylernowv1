"use client";

import { EmptyState, Panel, Poster, Status } from "@/components/brutal";
import { SelectorPlanes } from "@/components/planes/selector-planes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogoPais } from "@/lib/planes/catalogo";
import { formatearMoneda } from "@/lib/planes/moneda";
import { calcularPrecio, type CicloFacturacion } from "@/lib/planes/precios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cancelarDowngradeProgramado,
  cancelarMiNegocio,
  consultarEstadoUpgrade,
  iniciarPagoPlan,
  iniciarUpgrade,
  solicitarDowngrade,
  type MiSuscripcion,
  type PagoSuscripcion,
  type PlanCatalogo,
  type PlanCodigo,
} from "./actions";
import type { FundadorActivo } from "./datos";
import { iniciarPrueba } from "./prueba";
import type { ConfigPrueba } from "./config-prueba";

// Textos centralizados para facilitar la traducción posterior.
const T = {
  titulo: "Plan y facturación",
  intro: "Upgrade inmediato con cobro prorrateado. Downgrade programado para tu próximo ciclo de facturación.",
  estados: {
    REQUIERE_PLAN: { tono: "warn", texto: "Requiere plan" },
    TRIAL: { tono: "info", texto: "En prueba" },
    ACTIVA: { tono: "ok", texto: "Al día" },
    EN_MORA: { tono: "warn", texto: "En mora" },
    SUSPENDIDA: { tono: "err", texto: "Suspendida" },
    CANCELADA: { tono: "err", texto: "Cancelada" },
  } as Record<string, { tono: "ok" | "warn" | "err" | "info"; texto: string }>,
  requierePlan: "Tu perfil se ve pero no recibe reservas hasta que elijas plan.",
  enMora: (d: number) =>
    `Tu prueba o tu periodo pagado terminó. Te ${d === 1 ? "queda" : "quedan"} ${d} ${d === 1 ? "día" : "días"} de gracia: sigues recibiendo reservas, pero paga tu plan antes de que termine para no dejar de recibirlas.`,
  suspendida: "Tu negocio está suspendido y oculto del mapa.",
  suspendidaImpago: "Tu negocio está suspendido por impago y oculto del mapa.",
  soporte: "Escribe a soporte",
  manual: (tipo: string, hasta: string | null) =>
    `Plan activado manualmente por StylerNow (${tipo.toLowerCase()})${hasta ? `, vigente hasta ${hasta}` : ""}.`,
  // Migración 133: no hay cobro automático; al terminar la prueba el dueño paga su plan desde aquí.
  prueba: (d: number, fecha: string) =>
    `Prueba: ${d} ${d === 1 ? "día restante" : "días restantes"} (termina el ${fecha}). No se cobra nada automáticamente: puedes pagar tu plan cuando quieras y los días de prueba que te queden no se pierden.`,
  proxCobro: "Próximo cobro",
  finPrueba: "Fin de la prueba",
  plan: "Plan",
  ciclo: "Ciclo",
  pais: "País y moneda",
  precio: "Precio efectivo",
  uso: "Uso del plan",
  sedes: "Sedes",
  staff: "Staff",
  incluidas: "incluidas",
  ilimitado: "sin límite",
  aCotizar: "A cotizar",
  fundador: (pct: number, fecha: string) => `Descuento fundador −${pct}% hasta el ${fecha}`,
  elegir: "Elige o cambia tu plan",
  pruebaTitulo: (dias: number) => `Inicia tu prueba de ${dias} días`,
  pruebaIntro: "Sin tarjeta y sin cobros: registra tu teléfono y documento (solo para evitar pruebas repetidas). Al terminar eliges tu plan.",
  pruebaIntroTarjeta: "Registra tus datos. No se cobra nada hoy ni automáticamente: al terminar la prueba pagas tu plan desde aquí.",
  telefono: "Teléfono",
  documento: "Documento / NIT",
  token: "Método de pago",
  tokenAyuda: "El registro del método de pago se habilitará cuando el cobro automático esté disponible en tu país.",
  sinCobro: "El cobro automático aún no está disponible en tu país. Contáctanos y activamos tu plan manualmente.",
  iniciar: "Iniciar prueba",
  hablarVentas: "Hablar con ventas",
  ventasSignature: "Signature se cotiza con nuestro equipo de ventas.",
  upgrade: "Hacer upgrade",
  downgrade: "Programar downgrade",
  cancelarDowngrade: "Cancelar downgrade",
  trialCambio: "Durante la prueba no puedes cambiar de plan. Al terminar podrás subir o bajar de plan desde aquí.",
  zonaRiesgo: "Zona de riesgo",
  zonaRiesgoTexto:
    "Dar de baja tu negocio es definitivo. Tus reservas futuras se cancelan con reembolso del 100% y no puedes reactivarlo: para volver a operar necesitas un alta nueva.",
  baja: "Dar de baja mi negocio",
  sinCatalogo: "Aún no hay planes disponibles para tu país. Escribe a soporte para activar tu plan.",
  errorPago: "El pago fue rechazado por la pasarela. No se cobró nada; puedes intentar de nuevo.",
  pagarTitulo: (renovar: boolean) => (renovar ? "Renovar mi plan" : "Pagar mi plan"),
  pagarIntro:
    "Pagas con Mercado Pago a StylerNow. Tu plan se activa cuando Mercado Pago confirma el pago; no guardamos datos de tu tarjeta ni hacemos cobros automáticos.",
  pagarBoton: (plan: string, monto: string) => `Pagar ${plan} · ${monto}`,
  esperando: "Esperando la confirmación de Mercado Pago…",
  historial: "Historial de pagos del plan",
  historialVacio: "Todavía no has hecho pagos de plan.",
  conceptoPlan: "Plan",
  conceptoUpgrade: "Upgrade",
  estadosPago: { PENDIENTE: "Pendiente", APROBADO: "Aprobado", RECHAZADO: "Rechazado", REEMBOLSADO: "Reembolsado" } as Record<string, string>,
};

/** Estados desde los que el dueño puede pagar su plan (la base vuelve a validarlo en solicitar_pago_plan). */
function puedePagarPlan(s: MiSuscripcion): boolean {
  if (s.activacionManual) return false;
  if (s.estado === "TRIAL" || s.estado === "EN_MORA" || s.estado === "REQUIERE_PLAN") return true;
  if (s.estado === "SUSPENDIDA") return (s.suspendidoCausa ?? "IMPAGO") === "IMPAGO";
  if (s.estado === "ACTIVA") return new Date(s.fechaProximoCobro).getTime() - Date.now() <= 7 * 86_400_000;
  return false;
}

const CLAVE_DISPOSITIVO = "sn_dispositivo_id";

/** Identificador estable del dispositivo: se genera una vez y se persiste (try/catch por si el almacenamiento falla). */
function obtenerDispositivoId(): string {
  try {
    const existente = window.localStorage.getItem(CLAVE_DISPOSITIVO);
    if (existente) return existente;
    const nuevo = crypto.randomUUID();
    window.localStorage.setItem(CLAVE_DISPOSITIVO, nuevo);
    return nuevo;
  } catch {
    return crypto.randomUUID();
  }
}

function fechaCorta(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

export function VistaSuscripcion({
  negocioId,
  suscripcionInicial,
  planes,
  catalogo,
  uso,
  fundador,
  configPrueba,
  pagos,
}: {
  negocioId: string;
  suscripcionInicial: MiSuscripcion;
  planes: PlanCatalogo[];
  catalogo: CatalogoPais | null;
  uso: { sedes: number; staff: number };
  fundador: FundadorActivo | null;
  configPrueba: ConfigPrueba;
  pagos: PagoSuscripcion[];
}) {
  const router = useRouter();
  const [suscripcion, setSuscripcion] = useState(suscripcionInicial);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagoPendienteId, setPagoPendienteId] = useState<string | null>(null);
  const [urlCheckout, setUrlCheckout] = useState<string | null>(null);

  const esRequierePlan = suscripcion.estado === "REQUIERE_PLAN";
  const [seleccion, setSeleccion] = useState<PlanCodigo | null>(esRequierePlan ? null : (suscripcion.planCodigo as PlanCodigo));
  const [ciclo, setCiclo] = useState<CicloFacturacion>(suscripcion.ciclo);

  const [telefono, setTelefono] = useState("");
  const [documento, setDocumento] = useState("");
  const [errorPrueba, setErrorPrueba] = useState<string | null>(null);

  const locale = catalogo?.pais.locale ?? "es-CO";
  const planActual = planes.find((p) => p.codigo === suscripcion.planCodigo) ?? null;
  const planActualPais = catalogo?.planes.find((p) => p.codigo === suscripcion.planCodigo) ?? null;
  const planSel = catalogo?.planes.find((p) => p.codigo === seleccion) ?? null;
  const estadoInfo = T.estados[suscripcion.estado] ?? { tono: "info" as const, texto: suscripcion.estado };

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
        setError(T.errorPago);
      }
    }, 4000);
    return () => clearInterval(intervalo);
  }, [pagoPendienteId]);

  // Redirección al checkout de Mercado Pago aislada en un efecto (pureza de render).
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

  async function onPagarPlan(planCodigo: PlanCodigo) {
    setProcesando("pagar-plan");
    setError(null);
    const res = await iniciarPagoPlan(negocioId, planCodigo, ciclo);
    setProcesando(null);
    if (!res.ok) return setError(res.mensaje);
    setPagoPendienteId(res.pagoId);
    setUrlCheckout(res.url);
  }

  async function onDowngrade(planCodigo: PlanCodigo) {
    if (
      !confirm(
        `¿Programar el downgrade a ${planCodigo}? Se hace efectivo al inicio de tu próximo ciclo, el ${fechaCorta(suscripcion.fechaProximoCobro, locale)}.`,
      )
    )
      return;
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

  async function onIniciarPrueba(e: React.FormEvent) {
    e.preventDefault();
    if (!seleccion || seleccion === "SIGNATURE") return;
    setProcesando("prueba");
    setErrorPrueba(null);
    const res = await iniciarPrueba({
      negocioId,
      plan: seleccion,
      ciclo,
      telefono,
      documento,
      dispositivoId: obtenerDispositivoId(),
      metodoPagoToken: "", // prueba sin tarjeta; el SDK de tarjeta se integra con la fase de pagos
    });
    setProcesando(null);
    if (!res.ok) return setErrorPrueba(res.error);
    router.refresh();
  }

  // Precio efectivo del plan actual (el descuento fundador solo aplica a mensual; lo resuelve calcularPrecio).
  const precioActual =
    catalogo && planActualPais?.precioMensual != null
      ? calcularPrecio({
          precioMensual: planActualPais.precioMensual,
          ciclo: suscripcion.ciclo,
          mesesPagadosAnual: catalogo.pais.mesesPagadosAnual,
          descuentoFundadorPct: fundador?.descuentoPct ?? 0,
        })
      : null;

  const limiteSedes = planActual?.limiteSedes ?? planActualPais?.limiteSedes ?? null;
  const limiteStaff = planActual?.staffIncluido ?? planActualPais?.staffIncluido ?? null;
  const cotizaSel = seleccion === "SIGNATURE" || planSel?.precioMensual === null;
  const cobroOk = catalogo?.pais.cobroRecurrenteHabilitado ?? false;
  // La modalidad la define Super Admin (migración 118); la base de datos la vuelve a validar.
  const requiereTarjeta = configPrueba.modalidad === "CON_TARJETA";
  const enlaceSoporte = (
    <Link href="/panel/soporte" className="font-bold underline underline-offset-2">
      {T.soporte}
    </Link>
  );

  function accionCambio() {
    if (!seleccion || seleccion === suscripcion.planCodigo) return null;
    const destino = planes.find((p) => p.codigo === seleccion);
    if (seleccion === "SIGNATURE" || destino?.precioMensual == null) {
      return (
        <>
          <p className="text-[13px]">{T.ventasSignature}</p>
          <Button asChild>
            <Link href="/panel/soporte">{T.hablarVentas}</Link>
          </Button>
        </>
      );
    }
    if (destino.precioMensual > (planActual?.precioMensual ?? 0)) {
      return (
        <Button className="w-full" loading={procesando === seleccion} onClick={() => onUpgrade(seleccion)}>
          {T.upgrade} · {destino.nombre}
        </Button>
      );
    }
    return suscripcion.planCodigoDestino ? (
      <p className="sn-meta">Ya tienes un downgrade programado. Cancélalo para elegir otro.</p>
    ) : (
      <Button className="w-full" variant="secondary" loading={procesando === seleccion} onClick={() => onDowngrade(seleccion)}>
        {T.downgrade} · {destino.nombre}
      </Button>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl min-w-0 flex-1 px-4 py-8 sm:px-8">
      <Poster as="h1" size={3} className="mb-2 break-words">
        {T.titulo}
      </Poster>
      <p className="sn-meta mb-6 block">{T.intro}</p>

      {/* Estado del plan */}
      <Panel className="mb-6 flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="sn-label block">{T.plan}</span>
            <p className="poster-4 break-words">{esRequierePlan ? "—" : (planActual?.nombre ?? suscripcion.planCodigo)}</p>
          </div>
          <Status tone={estadoInfo.tono}>{estadoInfo.texto}</Status>
        </div>

        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <div>
            <dt className="sn-meta">{T.ciclo}</dt>
            <dd className="text-[15px] font-bold">{suscripcion.ciclo === "ANUAL" ? "Anual" : "Mensual"}</dd>
          </div>
          <div>
            <dt className="sn-meta">{T.pais}</dt>
            <dd className="text-[15px] font-bold">{catalogo ? `${catalogo.pais.nombre} · ${catalogo.pais.moneda}` : suscripcion.paisCodigo}</dd>
          </div>
          <div>
            <dt className="sn-meta">{T.precio}</dt>
            <dd className="text-[15px] font-bold">
              {esRequierePlan ? (
                "—"
              ) : precioActual && catalogo ? (
                <>
                  {precioActual.ahorro > 0 ? (
                    <span className="sn-meta mr-1 line-through">{formatearMoneda(precioActual.lista, catalogo.pais.moneda, catalogo.pais.locale)}</span>
                  ) : null}
                  {formatearMoneda(precioActual.final, catalogo.pais.moneda, catalogo.pais.locale)}
                  {suscripcion.ciclo === "ANUAL" ? "/año" : "/mes"}
                  {catalogo.pais.precioMasImpuesto ? " + IVA" : ""}
                </>
              ) : (
                T.aCotizar
              )}
            </dd>
            {fundador && suscripcion.ciclo === "MENSUAL" ? (
              <dd className="mt-1">
                <Status tone="warn">{T.fundador(fundador.descuentoPct, fechaCorta(fundador.fechaFin, locale))}</Status>
              </dd>
            ) : null}
          </div>
          <div>
            <dt className="sn-meta">{suscripcion.estado === "TRIAL" ? T.finPrueba : T.proxCobro}</dt>
            <dd className="text-[15px] font-bold">
              {esRequierePlan
                ? "—"
                : fechaCorta(suscripcion.estado === "TRIAL" && suscripcion.pruebaFin ? suscripcion.pruebaFin : suscripcion.fechaProximoCobro, locale)}
            </dd>
          </div>
        </dl>

        <div>
          <span className="sn-label mb-2 block">{T.uso}</span>
          <div className="grid grid-cols-2 gap-3">
            {[
              { et: T.sedes, usado: uso.sedes, lim: limiteSedes },
              { et: T.staff, usado: uso.staff, lim: limiteStaff },
            ].map((u) => (
              <div key={u.et} className="min-w-0 border-2 border-border p-3">
                <span className="sn-meta block">{u.et}</span>
                <span className="figure-md block">
                  {u.usado}
                  <span className="sn-meta"> / {u.lim ?? "∞"}</span>
                </span>
                <span className="sn-meta">{u.lim === null ? T.ilimitado : T.incluidas}</span>
              </div>
            ))}
          </div>
        </div>

        {esRequierePlan ? (
          <p role="status" className="border-2 border-border bg-signal p-3 text-[13px] font-bold text-ink">
            {T.requierePlan}
          </p>
        ) : null}
        {suscripcion.estado === "TRIAL" && suscripcion.diasPrueba !== null && suscripcion.pruebaFin ? (
          <p role="status" className="border-2 border-border p-3 text-[13px]">
            {T.prueba(suscripcion.diasPrueba, fechaCorta(suscripcion.pruebaFin, locale))}
          </p>
        ) : null}
        {suscripcion.estado === "EN_MORA" ? (
          <p role="alert" className="border-2 border-border p-3 text-[13px]">
            {T.enMora(suscripcion.diasGracia ?? 0)} {enlaceSoporte}.
          </p>
        ) : null}
        {suscripcion.estado === "SUSPENDIDA" ? (
          <p role="alert" className="border-2 border-danger p-3 text-[13px] text-danger">
            {suscripcion.suspendidoCausa === "IMPAGO" ? T.suspendidaImpago : T.suspendida} {enlaceSoporte}.
          </p>
        ) : null}
        {suscripcion.activacionManual ? (
          <p role="status" className="border-2 border-dashed border-border p-3 text-[13px]">
            {T.manual(suscripcion.manualTipo ?? "manual", suscripcion.manualHasta ? fechaCorta(suscripcion.manualHasta, locale) : null)}
          </p>
        ) : null}

        {suscripcion.planCodigoDestino ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-border p-3">
            <p className="min-w-0 text-[13px]">
              Downgrade programado a <b>{suscripcion.planCodigoDestino}</b> el {fechaCorta(suscripcion.fechaProximoCobro, locale)}.
            </p>
            <Button size="sm" variant="secondary" loading={procesando === "cancelar-downgrade"} onClick={onCancelarDowngrade}>
              {T.cancelarDowngrade}
            </Button>
          </div>
        ) : null}
      </Panel>

      {error ? (
        <p role="alert" className="mb-4 border-2 border-danger p-3 text-[13px] font-bold text-danger">
          {error}
        </p>
      ) : null}

      {/* Selector de plan */}
      {suscripcion.estado === "CANCELADA" ? null : !catalogo || catalogo.planes.length === 0 ? (
        <EmptyState
          big="Sin planes"
          title={T.sinCatalogo}
          action={
            <Button asChild variant="secondary">
              <Link href="/panel/soporte">{T.soporte}</Link>
            </Button>
          }
          className="mb-6"
        />
      ) : (
        <section className="mb-6 flex flex-col gap-4">
          <h2 className="section">{T.elegir}</h2>
          <SelectorPlanes
            catalogo={catalogo}
            value={seleccion}
            onChange={setSeleccion}
            ciclo={ciclo}
            onCicloChange={setCiclo}
            deshabilitadoCodigos={suscripcion.estado === "TRIAL" ? catalogo.planes.map((p) => p.codigo) : []}
          />

          {suscripcion.estado === "TRIAL" ? <p className="sn-meta">{T.trialCambio}</p> : null}

          {esRequierePlan && seleccion ? (
            cotizaSel ? (
              <Panel className="flex flex-col gap-3 p-4">
                <p className="text-[13px]">{T.ventasSignature}</p>
                <Button asChild>
                  <Link href="/panel/soporte">{T.hablarVentas}</Link>
                </Button>
              </Panel>
            ) : (
              <form onSubmit={onIniciarPrueba} className="p-card flex flex-col gap-4 p-4">
                <h3 className="section">{T.pruebaTitulo(configPrueba.dias)}</h3>
                <p className="sn-meta">{requiereTarjeta ? T.pruebaIntroTarjeta : T.pruebaIntro}</p>
                {requiereTarjeta && !cobroOk ? (
                  <p role="status" className="border-2 border-border bg-signal p-3 text-[13px] font-bold text-ink">
                    {T.sinCobro} {enlaceSoporte}.
                  </p>
                ) : null}
                <Input label={T.telefono} type="tel" inputMode="tel" autoComplete="tel" required value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                <Input label={T.documento} required value={documento} onChange={(e) => setDocumento(e.target.value)} />
                {requiereTarjeta ? (
                  <div className="flex flex-col gap-1">
                    <Input label={T.token} disabled readOnly value="" placeholder="No disponible por ahora" />
                    <span className="sn-meta">{T.tokenAyuda}</span>
                  </div>
                ) : null}
                {errorPrueba ? (
                  <p role="alert" className="border-2 border-danger p-3 text-[13px] font-bold text-danger">
                    {errorPrueba}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" loading={procesando === "prueba"} disabled={(requiereTarjeta && !cobroOk) || !telefono.trim() || !documento.trim()}>
                  {T.iniciar}
                </Button>
              </form>
            )
          ) : null}

          {puedePagarPlan(suscripcion) && !(esRequierePlan && !seleccion) ? (() => {
            // Durante la prueba se paga el plan elegido al iniciarla; en los demás estados, el seleccionado.
            const codigo = (suscripcion.estado === "TRIAL" || !seleccion ? suscripcion.planCodigo : seleccion) as PlanCodigo;
            const p = catalogo.planes.find((x) => x.codigo === codigo);
            if (!p || p.precioMensual == null || codigo === "SIGNATURE") return null;
            // Monto orientativo: el que se cobra lo calcula la base (solicitar_pago_plan).
            const precio = calcularPrecio({
              precioMensual: p.precioMensual,
              ciclo,
              mesesPagadosAnual: catalogo.pais.mesesPagadosAnual,
              descuentoFundadorPct: fundador?.descuentoPct ?? 0,
            });
            const monto = formatearMoneda(precio.final, catalogo.pais.moneda, catalogo.pais.locale);
            return (
              <Panel className="flex flex-col gap-3 p-4">
                <h3 className="section">{T.pagarTitulo(suscripcion.estado === "ACTIVA")}</h3>
                <p className="sn-meta">{T.pagarIntro}</p>
                {pagoPendienteId ? (
                  <p role="status" className="border-2 border-border p-3 text-[13px] font-bold">
                    {T.esperando}
                  </p>
                ) : null}
                <Button className="w-full" loading={procesando === "pagar-plan"} disabled={Boolean(pagoPendienteId)} onClick={() => onPagarPlan(codigo)}>
                  {T.pagarBoton(p.nombre, monto)}
                </Button>
              </Panel>
            );
          })() : null}

          {suscripcion.estado === "ACTIVA" && seleccion && seleccion !== suscripcion.planCodigo ? (
            <Panel className="flex flex-col gap-3 p-4">{accionCambio()}</Panel>
          ) : null}
        </section>
      )}

      <section className="mb-6">
        <h2 className="section mb-3">{T.historial}</h2>
        {pagos.length === 0 ? (
          <p className="sn-meta">{T.historialVacio}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pagos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-border p-3">
                <div className="min-w-0">
                  <span className="block text-[14px] font-bold break-words">
                    {p.concepto === "PLAN" ? T.conceptoPlan : T.conceptoUpgrade}
                    {p.plan ? ` · ${p.plan}` : ""}
                    {p.ciclo ? ` · ${p.ciclo === "ANUAL" ? "anual" : "mensual"}` : ""}
                  </span>
                  <span className="sn-meta">{fechaCorta(p.fecha, locale)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold">
                    {catalogo ? formatearMoneda(p.monto, catalogo.pais.moneda, catalogo.pais.locale) : p.monto}
                  </span>
                  <Status tone={p.estado === "APROBADO" ? "ok" : p.estado === "RECHAZADO" ? "err" : "info"}>
                    {T.estadosPago[p.estado] ?? p.estado}
                  </Status>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {suscripcion.estado === "ACTIVA" || suscripcion.estado === "SUSPENDIDA" ? (
        <section>
          <h2 className="section mb-3">{T.zonaRiesgo}</h2>
          <Panel className="flex flex-col gap-3 p-4">
            <p className="text-[13px]">{T.zonaRiesgoTexto}</p>
            <Button size="sm" variant="danger" loading={procesando === "cancelar-negocio"} onClick={onCancelarNegocio}>
              {T.baja}
            </Button>
          </Panel>
        </section>
      ) : null}
    </main>
  );
}
