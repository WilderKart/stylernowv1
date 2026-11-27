import type { CitaDelDia, ResumenDia } from "@/app/panel/dashboard-actions";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import { CalendarPlus, ChevronRight, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";

const ESTADO_CITA_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  PENDIENTE_PAGO: "neutral",
  CONFIRMADA: "accent",
  EN_CURSO: "success",
  COMPLETADA: "success",
  NO_SHOW: "danger",
};
const ESTADO_CITA_TEXTO: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  COMPLETADA: "Pagado",
  NO_SHOW: "No asistió",
};
const NEGOCIO_BADGE: Record<string, { texto: string; tono: "success" | "accent" | "danger" }> = {
  PENDIENTE_APROBACION: { texto: "En revisión", tono: "accent" },
  ACTIVO: { texto: "Aprobado", tono: "success" },
  SUSPENDIDO: { texto: "Suspendido", tono: "danger" },
  RECHAZADO: { texto: "Rechazado", tono: "danger" },
  CANCELADO: { texto: "Cancelado", tono: "danger" },
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

export interface LealtadResumen {
  membresiasActivas: number;
  miembrosVip: number;
  sellosCampanasActivas: number;
  cashbackOtorgadoMes: number;
  referidosCompletadosMes: number;
}

/**
 * Encabezado y tarjetas del resumen del Panel de Barbería (rediseño 2026-11).
 * Puramente presentacional: todos los datos llegan ya calculados y autorizados desde el servidor
 * (las mismas funciones del panel anterior). Sin datos del día no se inventan cifras: se muestra «—».
 */
export function ResumenBarberia({
  nombre,
  estadoNegocio,
  resumen,
  citas,
  lealtad,
}: {
  nombre: string;
  estadoNegocio: string;
  resumen: ResumenDia | null;
  citas: CitaDelDia[];
  lealtad: LealtadResumen | null;
}) {
  const badge = NEGOCIO_BADGE[estadoNegocio] ?? { texto: estadoNegocio, tono: "accent" as const };
  const activo = estadoNegocio === "ACTIVO";

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <header
        className="border-2 border-border bg-paper bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.7)_50%,rgba(255,255,255,0)_85%),url(/images/resumen-hero.jpg)] bg-cover bg-[position:78%_center] p-5 text-ink shadow-hard sm:p-6 sm:bg-[position:center_30%]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.66px] opacity-80">{nombre}</p>
            <h1 className="font-display mt-1 text-[clamp(26px,7vw,40px)] font-bold uppercase leading-none">Resumen de hoy</h1>
          </div>
          <Link
            href="/panel/verificacion"
            aria-label={`Estado del negocio: ${badge.texto}. Ver verificación`}
            className="inline-flex items-center gap-2 border-2 border-ink bg-paper px-3 py-1.5 text-[12px] font-bold uppercase text-ink shadow-hard-sm"
          >
            <ShieldCheck className="size-4 text-[#0a8a4a]" aria-hidden />
            {badge.texto}
          </Link>
        </div>
      </header>

      {/* Cifras del día */}
      {resumen ? (
        <section aria-label="Cifras de hoy" className="grid grid-cols-2 gap-px border-2 border-border bg-border shadow-hard lg:grid-cols-4">
          <Kpi etiqueta="Ingresos de hoy" valor={formatCOP(resumen.ingresosHoy)} />
          <Kpi etiqueta="Citas de hoy" valor={String(resumen.citasHoy)} />
          <Kpi etiqueta="Ocupación" valor={resumen.ocupacionPct != null ? `${resumen.ocupacionPct}%` : "—"} />
          <Kpi
            etiqueta="Próxima cita"
            valor={resumen.proximaCita ? hora(resumen.proximaCita.horaInicio) : "—"}
            detalle={resumen.proximaCita?.staffNombre ? `Con ${resumen.proximaCita.staffNombre}` : "Sin citas próximas"}
          />
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Últimas reservas */}
        <Card className="shadow-hard lg:col-span-1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-[16px] font-bold uppercase text-text">Reservas de hoy</h2>
            <Link href="/panel/agenda" className="border-2 border-border px-2.5 py-1 text-[11px] font-bold uppercase text-text hover:bg-text hover:text-bg">
              Ver agenda
            </Link>
          </div>
          {citas.length === 0 ? (
            <p className="border-2 border-dashed border-border-subtle px-3 py-6 text-center text-[12.5px] text-text-faint">
              {activo ? "No hay citas agendadas para hoy." : "Aparecerán aquí cuando tu negocio esté aprobado."}
            </p>
          ) : (
            <ul className="flex flex-col divide-y-2 divide-border-subtle">
              {citas.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-text">
                      {hora(c.horaInicio)} · {c.clienteNombre}
                    </p>
                    <p className="truncate text-[11.5px] text-text-faint">
                      {c.servicios || "Sin servicio registrado"}
                      {c.staffNombre ? ` · ${c.staffNombre}` : ""}
                    </p>
                  </div>
                  <Badge tone={ESTADO_CITA_TONO[c.estado] ?? "neutral"}>{ESTADO_CITA_TEXTO[c.estado] ?? c.estado}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Fidelidad y lealtad */}
        <Card className="shadow-hard">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-[16px] font-bold uppercase text-text">Fidelidad y lealtad</h2>
            <Link href="/panel/lealtad" className="border-2 border-border px-2.5 py-1 text-[11px] font-bold uppercase text-text hover:bg-text hover:text-bg">
              Gestionar
            </Link>
          </div>
          {lealtad ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Dato valor={lealtad.membresiasActivas} etiqueta="Membresías" />
                <Dato valor={lealtad.miembrosVip} etiqueta="Miembros VIP" />
                <Dato valor={lealtad.sellosCampanasActivas} etiqueta="Campañas de sellos" />
              </div>
              <p className="mt-3 text-[12px] text-text-muted">
                Cashback otorgado este mes: <strong className="text-text">{formatCOP(lealtad.cashbackOtorgadoMes)}</strong>
                <br />
                Referidos completados este mes: <strong className="text-text">{lealtad.referidosCompletadosMes}</strong>
              </p>
            </>
          ) : (
            <p className="border-2 border-dashed border-border-subtle px-3 py-6 text-center text-[12.5px] text-text-faint">
              Las cifras de lealtad aparecen cuando tu negocio esté aprobado.
            </p>
          )}
        </Card>

        {/* Acciones rápidas */}
        <Card className="shadow-hard">
          <h2 className="font-display mb-3 text-[16px] font-bold uppercase text-text">Acciones rápidas</h2>
          <ul className="flex flex-col gap-2.5">
            <Accion href="/panel/agenda" Icono={CalendarPlus} texto="Crear nueva cita" />
            <Accion href="/panel/whatsapp" Icono={MessageCircle} texto="Enviar campaña por WhatsApp" />
            <Accion href="/panel/verificacion" Icono={ShieldCheck} texto="Ver mi verificación" />
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="bg-[image:var(--kpi-gradient)] px-4 py-3.5 text-[var(--hero-text)]">
      <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.66px] opacity-85">{etiqueta}</p>
      <p className="font-display mt-1 text-[clamp(20px,5vw,28px)] font-bold leading-none">{valor}</p>
      {detalle ? <p className="mt-1 truncate text-[11px] opacity-85">{detalle}</p> : null}
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="border-2 border-border-subtle px-1 py-2.5">
      <AnimatedCounter value={valor} className="font-display text-[22px] font-bold text-text" />
      <p className="mt-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-text-faint">{etiqueta}</p>
    </div>
  );
}

function Accion({ href, Icono, texto }: { href: string; Icono: typeof ChevronRight; texto: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-12 items-center gap-3 border-2 border-border bg-app px-3 py-2 text-[13px] font-bold text-text shadow-hard-sm transition-transform hover:-translate-y-px"
      >
        <Icono className="size-5 shrink-0 text-accent" aria-hidden />
        <span className="flex-1">{texto}</span>
        <ChevronRight className="size-4 text-text-faint" aria-hidden />
      </Link>
    </li>
  );
}
