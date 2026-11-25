import type { CitaDelDia, ResumenDia } from "@/app/panel/dashboard-actions";
import { formatCOP } from "@/lib/utils";
import { CalendarClock, CalendarDays, CalendarPlus, ChevronRight, Gauge, Gift, MessageCircle, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { LealtadResumen } from "./resumen-barberia";

/**
 * Resumen del panel de spa, salón y uñas (diseño unificado, referencia «Resumen»).
 * Presentacional: los datos llegan calculados y autorizados desde el servidor. Sin datos reales no se inventan
 * cifras: se muestra «—» o un estado vacío.
 */

const ESTADO_TEXTO: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  COMPLETADA: "Pagado",
  NO_SHOW: "No asistió",
};
const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE_PAGO: "bg-[var(--pn-amber-soft)] text-[var(--pn-amber)]",
  CONFIRMADA: "bg-[var(--pn-blue-soft)] text-[var(--pn-blue)]",
  EN_CURSO: "bg-[var(--pn-violet-soft)] text-[var(--pn-violet)]",
  COMPLETADA: "bg-[var(--pn-green-soft)] text-[var(--pn-green)]",
  NO_SHOW: "bg-[var(--pn-rose-soft)] text-[var(--pn-rose)]",
};
const NEGOCIO_ESTADO: Record<string, string> = {
  PENDIENTE_APROBACION: "En revisión",
  ACTIVO: "Aprobado",
  SUSPENDIDO: "Suspendido",
  RECHAZADO: "Rechazado",
  CANCELADO: "Cancelado",
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Lunes a domingo de la semana actual en hora de Colombia. */
function semanaActual() {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [a, m, d] = hoy.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  const dow = base.getUTCDay();
  const lunes = new Date(base);
  lunes.setUTCDate(base.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return {
    hoy,
    mes: base.toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }),
    dias: Array.from({ length: 7 }, (_, i) => {
      const x = new Date(lunes);
      x.setUTCDate(lunes.getUTCDate() + i);
      return { iso: x.toISOString().slice(0, 10), nombre: DIAS[x.getUTCDay()], numero: x.getUTCDate() };
    }),
  };
}

function Tarjeta({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`pn-card bg-[var(--bg)] p-5 shadow-[var(--sn-shadow-hard-sm)] ring-1 ring-[var(--line)] ${className}`}>{children}</section>;
}

function Encabezado({ titulo, href, enlace }: { titulo: string; href?: string; enlace?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[16px] font-extrabold text-[var(--text)]">{titulo}</h2>
      {href ? (
        <Link href={href} className="pn-pill inline-flex min-h-9 items-center gap-1 bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]">
          {enlace}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function Indicador({ Icono, etiqueta, valor, detalle, tono }: { Icono: LucideIcon; etiqueta: string; valor: string; detalle?: string; tono: "green" | "violet" | "blue" | "orange" }) {
  return (
    <div className="pn-card flex min-w-0 items-center gap-3 bg-[var(--bg)] p-4 shadow-[var(--sn-shadow-hard-sm)] ring-1 ring-[var(--line)]">
      <span className="pn-pill grid size-11 shrink-0 place-items-center" style={{ background: `var(--pn-${tono}-soft)`, color: `var(--pn-${tono})` }}>
        <Icono className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium text-[var(--text-muted)]">{etiqueta}</p>
        <p className="truncate text-[22px] font-extrabold leading-tight text-[var(--text)]">{valor}</p>
        {detalle ? <p className="truncate text-[11.5px] text-[var(--text-faint)]">{detalle}</p> : null}
      </div>
    </div>
  );
}

function Accion({ href, Icono, texto }: { href: string; Icono: LucideIcon; texto: string }) {
  return (
    <li>
      <Link href={href} className="pn-card flex min-h-[88px] flex-col items-center justify-center gap-2 bg-[var(--surface)] p-3 text-center text-[12.5px] font-semibold leading-tight text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]">
        <Icono className="size-6 text-[var(--pn-violet)]" aria-hidden />
        {texto}
      </Link>
    </li>
  );
}

export function ResumenSuave({
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
  const activo = estadoNegocio === "ACTIVO";
  const semana = semanaActual();
  const proximas = citas.filter((c) => c.estado !== "COMPLETADA" && c.estado !== "NO_SHOW").slice(0, 4);

  return (
    <div className="flex flex-col gap-5">
      {/* Bienvenida */}
      <header className="pn-card relative overflow-hidden bg-[image:var(--hero-gradient)] p-6 text-[var(--hero-text)] shadow-[var(--sn-shadow-hard)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold opacity-80">{nombre}</p>
            <h1 className="mt-1 text-[clamp(28px,6vw,40px)] font-extrabold leading-tight" style={{ color: "inherit" }}>
              Resumen de hoy
            </h1>
            <p className="mt-1.5 max-w-md text-[14px] leading-snug opacity-85">Panorama general de tu negocio: citas, ingresos y actividad.</p>
          </div>
          <Link
            href="/panel/verificacion"
            aria-label={`Estado del negocio: ${NEGOCIO_ESTADO[estadoNegocio] ?? estadoNegocio}. Ver verificación`}
            className="pn-pill inline-flex min-h-10 items-center gap-2 bg-[var(--bg)] px-4 text-[13px] font-semibold text-[var(--text)] shadow-[var(--sn-shadow-hard-sm)]"
          >
            <ShieldCheck className="size-4 text-[var(--pn-green)]" aria-hidden />
            {NEGOCIO_ESTADO[estadoNegocio] ?? estadoNegocio}
          </Link>
        </div>
      </header>

      {/* Indicadores del día */}
      {resumen ? (
        <section aria-label="Cifras de hoy" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador Icono={Wallet} tono="green" etiqueta="Ingresos de hoy" valor={formatCOP(resumen.ingresosHoy)} />
          <Indicador Icono={CalendarDays} tono="violet" etiqueta="Citas de hoy" valor={String(resumen.citasHoy)} />
          <Indicador Icono={Gauge} tono="blue" etiqueta="Ocupación" valor={resumen.ocupacionPct != null ? `${resumen.ocupacionPct}%` : "—"} />
          <Indicador
            Icono={CalendarClock}
            tono="orange"
            etiqueta="Próxima cita"
            valor={resumen.proximaCita ? hora(resumen.proximaCita.horaInicio) : "—"}
            detalle={resumen.proximaCita?.staffNombre ? `Con ${resumen.proximaCita.staffNombre}` : "Sin citas próximas"}
          />
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Tarjeta>
            <Encabezado titulo="Reservas de hoy" href="/panel/agenda" enlace="Ver agenda" />
            {citas.length === 0 ? (
              <p className="pn-card bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--text-faint)]">
                {activo ? "No hay citas agendadas para hoy." : "Aparecerán aquí cuando tu negocio esté aprobado."}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--line)]">
                {citas.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <span className="pn-pill shrink-0 bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--text)]">{hora(c.horaInicio)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-[var(--text)]">{c.clienteNombre}</p>
                      <p className="truncate text-[12px] text-[var(--text-faint)]">
                        {c.servicios || "Sin servicio registrado"}
                        {c.staffNombre ? ` · ${c.staffNombre}` : ""}
                      </p>
                    </div>
                    <span className={`pn-chip shrink-0 px-3 py-1 text-[12px] font-semibold ${ESTADO_COLOR[c.estado] ?? "bg-[var(--surface-2)] text-[var(--text)]"}`}>
                      {ESTADO_TEXTO[c.estado] ?? c.estado}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta>
            <Encabezado titulo="Fidelidad y lealtad" href="/panel/lealtad" enlace="Gestionar" />
            {lealtad ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { v: lealtad.membresiasActivas, e: "Membresías" },
                    { v: lealtad.miembrosVip, e: "Miembros VIP" },
                    { v: lealtad.sellosCampanasActivas, e: "Campañas de sellos" },
                  ].map((d) => (
                    <div key={d.e} className="pn-card bg-[var(--surface)] px-2 py-3">
                      <p className="text-[24px] font-extrabold leading-none text-[var(--text)]">{d.v}</p>
                      <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">{d.e}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 flex items-start gap-2 text-[12.5px] text-[var(--text-muted)]">
                  <Gift className="mt-0.5 size-4 shrink-0 text-[var(--pn-violet)]" aria-hidden />
                  <span>
                    Cashback otorgado este mes: <strong className="text-[var(--text)]">{formatCOP(lealtad.cashbackOtorgadoMes)}</strong> · Referidos completados:{" "}
                    <strong className="text-[var(--text)]">{lealtad.referidosCompletadosMes}</strong>
                  </span>
                </p>
              </>
            ) : (
              <p className="pn-card bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--text-faint)]">Las cifras de lealtad aparecen cuando tu negocio esté aprobado.</p>
            )}
          </Tarjeta>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Tarjeta>
            <h2 className="mb-3 text-[18px] font-extrabold capitalize text-[var(--text)]">{semana.mes}</h2>
            <ol className="grid grid-cols-7 gap-1 text-center" aria-label="Semana actual">
              {semana.dias.map((d) => {
                const esHoy = d.iso === semana.hoy;
                return (
                  <li key={d.iso}>
                    <Link
                      href="/panel/agenda"
                      aria-current={esHoy ? "date" : undefined}
                      className={`pn-card flex flex-col items-center gap-1 py-2 text-[11.5px] font-medium ${esHoy ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-muted)] hover:bg-[var(--surface)]"}`}
                    >
                      {d.nombre}
                      <span className={`text-[16px] font-extrabold ${esHoy ? "text-[var(--bg)]" : "text-[var(--text)]"}`}>{d.numero}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <h3 className="mb-2 mt-5 text-[15px] font-extrabold text-[var(--text)]">Próximas citas</h3>
            {proximas.length === 0 ? (
              <p className="pn-card bg-[var(--surface)] px-4 py-6 text-center text-[12.5px] text-[var(--text-faint)]">Sin citas pendientes hoy.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {proximas.map((c) => (
                  <li key={c.id} className="pn-card flex items-center gap-3 bg-[var(--surface)] px-3 py-2.5">
                    <span className="text-[12.5px] font-bold text-[var(--text)]">{hora(c.horaInicio)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{c.clienteNombre}</span>
                      <span className="block truncate text-[11.5px] text-[var(--text-faint)]">{c.servicios || "Sin servicio registrado"}</span>
                    </span>
                    <span className={`pn-chip shrink-0 px-2.5 py-0.5 text-[11px] font-semibold ${ESTADO_COLOR[c.estado] ?? "bg-[var(--surface-2)] text-[var(--text)]"}`}>{ESTADO_TEXTO[c.estado] ?? c.estado}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta>
            <h2 className="mb-3 text-[16px] font-extrabold text-[var(--text)]">Acciones rápidas</h2>
            <ul className="grid grid-cols-3 gap-2.5">
              <Accion href="/panel/agenda" Icono={CalendarPlus} texto="Nueva cita" />
              <Accion href="/panel/whatsapp" Icono={MessageCircle} texto="Campaña WhatsApp" />
              <Accion href="/panel/verificacion" Icono={ShieldCheck} texto="Mi verificación" />
            </ul>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
