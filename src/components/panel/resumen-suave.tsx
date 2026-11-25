import type { CitaDelDia, ResumenDia } from "@/app/panel/dashboard-actions";
import type { DatosResumenSuave } from "@/app/panel/resumen-datos";
import { formatCOP } from "@/lib/utils";
import { Bell, CalendarClock, CalendarDays, CalendarPlus, ChevronRight, Gift, MessageCircle, ShieldCheck, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";


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

export interface LealtadResumen {
  membresiasActivas: number;
  miembrosVip: number;
  sellosCampanasActivas: number;
  cashbackOtorgadoMes: number;
  referidosCompletadosMes: number;
}

const HERO_TEXTO = "Gestiona tu negocio, agenda tus citas y haz crecer tu negocio desde un solo lugar.";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

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

function Tarjeta({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`pn-card min-w-0 bg-[var(--bg)] p-4 shadow-[var(--sn-shadow-hard-sm)] ring-1 ring-[var(--line)] sm:p-5 ${className}`}>{children}</section>;
}

function Encabezado({ titulo, href, enlace }: { titulo: string; href?: string; enlace?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[16px] font-extrabold text-[var(--text)]">{titulo}</h2>
      {href ? (
        <Link href={href} className="inline-flex min-h-9 items-center gap-1 text-[12.5px] font-semibold text-[var(--accent-text)] hover:underline">
          {enlace}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="pn-card bg-[var(--surface)] px-4 py-6 text-center text-[12.5px] leading-snug text-[var(--text-faint)]">{children}</p>;
}

function Indicador({ Icono, etiqueta, valor, detalle, tono }: { Icono: LucideIcon; etiqueta: string; valor: string; detalle?: string; tono: "green" | "violet" | "blue" | "orange" }) {
  return (
    <div className="pn-card flex min-w-0 flex-col items-start gap-2 bg-[var(--bg)] p-3 shadow-[var(--sn-shadow-hard-sm)] ring-1 ring-[var(--line)] min-[600px]:flex-row min-[600px]:items-center min-[600px]:gap-3 min-[600px]:p-4">
      <span className="pn-pill grid size-9 shrink-0 place-items-center min-[600px]:size-11" style={{ background: `var(--pn-${tono}-soft)`, color: `var(--pn-${tono})` }}>
        <Icono className="size-5" aria-hidden />
      </span>
      <div className="w-full min-w-0">
        <p className="truncate text-[12px] font-medium text-[var(--text-muted)] min-[600px]:text-[12.5px]">{etiqueta}</p>
        <p className="truncate text-[17px] font-extrabold leading-tight text-[var(--text)] min-[600px]:text-[22px]">{valor}</p>
        {detalle ? <p className="truncate text-[11.5px] font-medium text-[var(--text-faint)]">{detalle}</p> : null}
      </div>
    </div>
  );
}

function Avatar({ nombre, fotoUrl, tam = "size-14" }: { nombre: string; fotoUrl: string | null; tam?: string }) {
  return fotoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- foto del staff en Storage; sin optimizador para no ampliar remotePatterns
    <img src={fotoUrl} alt="" className={`${tam} shrink-0 rounded-full object-cover ring-2 ring-[var(--bg)]`} />
  ) : (
    <span className={`${tam} grid shrink-0 place-items-center rounded-full bg-[var(--pn-violet-soft)] text-[14px] font-extrabold text-[var(--pn-violet)]`} aria-hidden>
      {iniciales(nombre)}
    </span>
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

/** Anillo con los servicios más pedidos (SVG, sin dependencias). */
function Anillo({ items }: { items: { nombre: string; veces: number }[] }) {
  const total = items.reduce((a, i) => a + i.veces, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  const opac = [1, 0.7, 0.45, 0.25];
  const inicios = items.map((_, i) => items.slice(0, i).reduce((a, x) => a + (x.veces / total) * C, 0));
  return (
    <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
      <div className="relative mx-auto size-[132px] shrink-0">
        <svg viewBox="0 0 132 132" className="size-full -rotate-90" role="img" aria-label="Distribución de servicios más solicitados">
          <circle cx="66" cy="66" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
          {items.map((it, i) => {
            const largo = (it.veces / total) * C;
            return (
              <circle
                key={it.nombre}
                cx="66"
                cy="66"
                r={R}
                fill="none"
                stroke="var(--pn-violet)"
                strokeOpacity={opac[i] ?? 0.25}
                strokeWidth="16"
                strokeDasharray={`${Math.max(largo - 1.5, 0)} ${C}`}
                strokeDashoffset={-inicios[i]}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-[24px] font-extrabold leading-none text-[var(--text)]">{total}</span>
          <span className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">servicios</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 basis-40 space-y-2">
        {items.map((it, i) => (
          <li key={it.nombre} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: "var(--pn-violet)", opacity: opac[i] ?? 0.25 }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[var(--text)]">{it.nombre}</span>
            <span className="font-bold text-[var(--text)]">{Math.round((it.veces / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Barras({ puntos }: { puntos: { etiqueta: string; valor: number }[] }) {
  const max = Math.max(...puntos.map((p) => p.valor), 1);
  return (
    <div className="mt-3 flex h-[132px] items-end gap-2 border-b border-[var(--line)] sm:gap-3" role="img" aria-label={`Ingresos de los últimos ${puntos.length} meses`}>
      {puntos.map((p, i) => (
        <div key={p.etiqueta + i} className="flex h-full min-w-0 flex-1 flex-col justify-end">
          <div
            className="w-full rounded-t-xl"
            style={{ height: `${Math.max((p.valor / max) * 100, p.valor > 0 ? 8 : 3)}%`, background: "var(--pn-violet)", opacity: i === puntos.length - 1 ? 1 : 0.28 }}
            title={`${p.etiqueta}: ${formatCOP(p.valor)}`}
          />
        </div>
      ))}
    </div>
  );
}

export function ResumenSuave({
  nombre,
  estadoNegocio,
  resumen,
  citas,
  lealtad,
  datos,
  pagosPorRevisar,
  tareas,
}: {
  nombre: string;
  estadoNegocio: string;
  resumen: ResumenDia | null;
  citas: CitaDelDia[];
  lealtad: LealtadResumen | null;
  datos: DatosResumenSuave;
  pagosPorRevisar: number;
  /** Tareas de configuración (componente cliente): se ubican dentro de la cuadrícula. */
  tareas: ReactNode;
}) {
  const activo = estadoNegocio === "ACTIVO";
  const semana = semanaActual();
  const proximas = citas.filter((c) => c.estado !== "COMPLETADA" && c.estado !== "NO_SHOW").slice(0, 4);
  const dif = resumen && datos.citasAyer !== null ? resumen.citasHoy - datos.citasAyer : null;
  const ing = datos.ingresos;
  const variacion = ing.mesAnterior !== null && ing.mesAnterior > 0 ? Math.round(((ing.mesActual - ing.mesAnterior) / ing.mesAnterior) * 100) : null;

  const notificaciones = [
    ...(pagosPorRevisar > 0
      ? [{ clave: "pagos", titulo: "Pagos por revisar", detalle: `${pagosPorRevisar} ${pagosPorRevisar === 1 ? "transferencia espera" : "transferencias esperan"} tu verificación.`, cuando: "Pendiente", href: "/panel/pagos", tono: "amber" as const }]
      : []),
    ...datos.notificaciones,
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Bienvenida */}
          <header className="pn-card relative isolate min-h-[168px] overflow-hidden bg-[image:var(--hero-gradient)] p-5 text-[var(--hero-text)] shadow-[var(--sn-shadow-hard)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 sm:max-w-[58%]">
                <p className="truncate text-[13px] font-semibold opacity-80">{nombre}</p>
                <h1 className="mt-1 text-[clamp(26px,6vw,36px)] font-extrabold leading-tight" style={{ color: "inherit" }}>
                  ¡Bienvenido a StylerNow!
                </h1>
                <p className="mt-2 max-w-md text-[14px] leading-snug opacity-90">{HERO_TEXTO}</p>
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

          {/* Indicadores */}
          <section aria-label="Cifras de hoy" className="grid grid-cols-3 gap-2 sm:gap-3">
            <Indicador
              Icono={CalendarDays}
              tono="violet"
              etiqueta="Citas de hoy"
              valor={resumen ? String(resumen.citasHoy) : "—"}
              detalle={dif === null ? (resumen?.ocupacionPct != null ? `Ocupación ${resumen.ocupacionPct}%` : undefined) : dif === 0 ? "Igual que ayer" : `${dif > 0 ? "+" : ""}${dif} vs. ayer`}
            />
            <Indicador Icono={Wallet} tono="green" etiqueta="Ingresos de hoy" valor={resumen ? formatCOP(resumen.ingresosHoy) : "—"} detalle={resumen?.proximaCita ? `Próxima cita ${hora(resumen.proximaCita.horaInicio)}` : undefined} />
            <Indicador Icono={Users} tono="blue" etiqueta="Clientes activos" valor={datos.clientesActivos !== null ? String(datos.clientesActivos) : "—"} detalle="Últimos 90 días" />
          </section>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <Tarjeta>
              <Encabezado titulo={`Equipo (${datos.equipo.total})`} href="/panel/staff" enlace="Ver equipo" />
              {datos.equipo.miembros.length === 0 ? (
                <Vacio>Aún no tienes profesionales activos. Invita a tu equipo desde Equipo y servicios.</Vacio>
              ) : (
                <ul className="flex flex-wrap gap-x-4 gap-y-3">
                  {datos.equipo.miembros.map((m) => (
                    <li key={m.nombre} className="flex w-[64px] flex-col items-center text-center">
                      <Avatar nombre={m.nombre} fotoUrl={m.fotoUrl} />
                      <span className="mt-1.5 w-full truncate text-[12.5px] font-semibold text-[var(--text)]">{m.nombre.split(" ")[0]}</span>
                      <span className="w-full truncate text-[11px] text-[var(--text-faint)]">{m.especialidad ?? "Profesional"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta>
              <Encabezado titulo="Servicios más solicitados" href="/panel/reportes" enlace="Reportes" />
              {!datos.servicios.disponible ? (
                <Vacio>
                  Esta estadística viene en planes con reportes por período.{" "}
                  <Link href="/panel/suscripcion" className="font-semibold text-[var(--accent-text)] underline">
                    Ver mi plan
                  </Link>
                </Vacio>
              ) : datos.servicios.items.length === 0 ? (
                <Vacio>Todavía no hay servicios completados en los últimos 90 días.</Vacio>
              ) : (
                <Anillo items={datos.servicios.items} />
              )}
            </Tarjeta>

            <Tarjeta>
              <Encabezado titulo="Ingresos" href="/panel/reportes" enlace="Ver reporte" />
              {!ing.disponible ? (
                <Vacio>
                  El histórico mensual viene en planes con reportes por período.{" "}
                  <Link href="/panel/suscripcion" className="font-semibold text-[var(--accent-text)] underline">
                    Ver mi plan
                  </Link>
                </Vacio>
              ) : (
                <>
                  <p className="text-[26px] font-extrabold leading-tight text-[var(--text)]">{formatCOP(ing.mesActual)}</p>
                  <p className="text-[12.5px] font-semibold text-[var(--text-muted)]">
                    {variacion === null ? "Este mes · sin mes anterior para comparar" : `${variacion >= 0 ? "▲ +" : "▼ "}${variacion}% vs. mes anterior`}
                  </p>
                  <Barras puntos={ing.puntos} />
                  <div className="mt-1.5 flex gap-2 sm:gap-3" aria-hidden>
                    {ing.puntos.map((p, i) => (
                      <span key={p.etiqueta + i} className="min-w-0 flex-1 text-center text-[11.5px] text-[var(--text-muted)]">
                        {p.etiqueta}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </Tarjeta>

            {tareas}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 sm:gap-5" aria-label="Agenda y avisos">
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
            <div className="mb-2 mt-5 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-extrabold text-[var(--text)]">Próximas citas</h3>
              <Link href="/panel/agenda" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--accent-text)] hover:underline">
                Ver agenda <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            {proximas.length === 0 ? (
              <Vacio>{activo ? "Sin citas pendientes hoy." : "Aparecerán aquí cuando tu negocio esté aprobado."}</Vacio>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--line)]">
                {proximas.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-[58px] shrink-0 text-[12.5px] font-bold text-[var(--text)]">{hora(c.horaInicio)}</span>
                    <Avatar nombre={c.clienteNombre} fotoUrl={null} tam="size-9" />
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
            <Encabezado titulo="Notificaciones" />
            {notificaciones.length === 0 ? (
              <Vacio>
                <Bell className="mx-auto mb-1 size-5 text-[var(--text-faint)]" aria-hidden />
                Sin novedades por ahora.
              </Vacio>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--line)]">
                {notificaciones.map((n) => (
                  <li key={n.clave}>
                    <Link href={n.href} className="flex items-start gap-3 py-3">
                      <span className="pn-pill grid size-10 shrink-0 place-items-center" style={{ background: `var(--pn-${n.tono}-soft)`, color: `var(--pn-${n.tono})` }}>
                        {n.tono === "amber" ? <Wallet className="size-[18px]" aria-hidden /> : <CalendarClock className="size-[18px]" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-bold text-[var(--text)]">{n.titulo}</span>
                          <span className="shrink-0 text-[11px] text-[var(--text-faint)]">{n.cuando}</span>
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-muted)]">{n.detalle}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </aside>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
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
            <Vacio>Las cifras de lealtad aparecen cuando tu negocio esté aprobado.</Vacio>
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
  );
}
