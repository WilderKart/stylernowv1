import { formatCOP } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  Layers,
  LifeBuoy,
  Scale,
  Settings,
  ShieldAlert,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { EncabezadoAdmin } from "./_componentes/encabezado-admin";
import { obtenerResumenAdmin } from "./actions";
import { contadoresAdmin, obtenerTablero } from "./tablero";

function haceCuanto(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

/** Tarjeta con borde negro duro y franja naranja a la izquierda (estilo del sistema brutalista). */
function Caja({ children, className = "", destacada = false }: { children: React.ReactNode; className?: string; destacada?: boolean }) {
  return (
    <section
      className={`min-w-0 border-2 border-border bg-bg ${destacada ? "border-l-[6px] border-l-accent" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

function TituloCaja({ children, href, extra }: { children: React.ReactNode; href?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
      <h2 className="font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-text">{children}</h2>
      <div className="flex items-center gap-3">
        {extra}
        {href && (
          <Link href={href} className="grid size-8 place-items-center text-text hover:text-accent" aria-label="Ver detalle">
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icono: Icono,
  etiqueta,
  valor,
  nota,
  href,
  destacada,
}: {
  icono: React.ComponentType<{ className?: string }>;
  etiqueta: string;
  valor: string;
  nota?: string;
  href: string;
  destacada?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex min-w-0 flex-col justify-between gap-3 border-2 border-border bg-bg p-4 transition-shadow hover:shadow-[4px_4px_0_0_var(--shadow-ink)] sm:p-5 ${
        destacada ? "border-l-[6px] border-l-accent" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <Icono className="size-5 shrink-0 text-text" aria-hidden />
          <span className="font-mono text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-text">{etiqueta}</span>
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-text-faint group-hover:text-accent" aria-hidden />
      </div>
      <div>
        <p className="font-display truncate text-[26px] font-black leading-none text-text sm:text-[32px]">{valor}</p>
        {nota && <p className="mt-1.5 text-[11.5px] font-semibold text-text-muted">{nota}</p>}
      </div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const [resumen, tablero, contadores] = await Promise.all([obtenerResumenAdmin(), obtenerTablero(), contadoresAdmin()]);
  const r = resumen.ok ? resumen.data : null;
  const max = Math.max(1, ...tablero.reservas14.map((d) => d.reservas));
  const escala = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];

  const est = tablero.negociosPorEstado;
  const total = tablero.totalNegocios;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const otros = est.SUSPENDIDO + est.RECHAZADO + est.CANCELADO;
  const gradoActivos = total > 0 ? (est.ACTIVO / total) * 360 : 0;
  const gradoPendientes = total > 0 ? (est.PENDIENTE_APROBACION / total) * 360 : 0;
  const dona =
    total === 0
      ? "var(--surface-2)"
      : `conic-gradient(var(--signal) 0deg ${gradoActivos}deg, var(--grid-soft) ${gradoActivos}deg ${
          gradoActivos + gradoPendientes
        }deg, var(--text-faint) ${gradoActivos + gradoPendientes}deg 360deg)`;

  const tareas = [
    {
      icono: Store,
      titulo: `${contadores.negociosPendientes} ${contadores.negociosPendientes === 1 ? "negocio espera" : "negocios esperan"} aprobación`,
      detalle: "Revisa los datos y aprueba o rechaza.",
      href: "/admin/negocios",
      n: contadores.negociosPendientes,
    },
    {
      icono: LifeBuoy,
      titulo: `${contadores.ticketsAbiertos} ${contadores.ticketsAbiertos === 1 ? "ticket de soporte abierto" : "tickets de soporte abiertos"}`,
      detalle: "Responde a las barberías.",
      href: "/admin/soporte",
      n: contadores.ticketsAbiertos,
    },
    {
      icono: ShieldAlert,
      titulo: `${contadores.resenasReportadas} ${contadores.resenasReportadas === 1 ? "reseña reportada" : "reseñas reportadas"}`,
      detalle: "Decide si se mantienen o se ocultan.",
      href: "/admin/moderacion",
      n: contadores.resenasReportadas,
    },
  ].filter((t) => t.n > 0);

  const accesos = [
    { href: "/admin/negocios", etiqueta: "Aprobar negocios", icono: Store },
    { href: "/admin/planes", etiqueta: "Gestionar planes", icono: Layers },
    { href: "/admin/reglas", etiqueta: "Editar reglas", icono: Scale },
    { href: "/admin/auditoria", etiqueta: "Ver auditoría", icono: Activity },
    { href: "/admin/configuracion", etiqueta: "Configuración", icono: Settings },
  ];

  return (
    <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Panel Super Admin"
        titulo="Control total de la"
        resaltado="plataforma."
        descripcion="Opera, supervisa y escala el ecosistema StylerNow."
        acciones={
          <span className="inline-flex items-center gap-2 border-2 border-border px-3 py-2 font-mono text-[11.5px] font-bold uppercase text-text">
            <CalendarDays className="size-4" aria-hidden />
            Últimos 14 días
          </span>
        }
      />

      {!resumen.ok && (
        <p className="mb-4 border-2 border-danger px-4 py-3 text-[12.5px] font-semibold text-danger">{resumen.error}</p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          icono={Store}
          etiqueta="Negocios activos"
          valor={String(r?.negociosActivos ?? est.ACTIVO)}
          nota={`${r?.negociosPendientes ?? est.PENDIENTE_APROBACION} pendientes · ${r?.ciudadesActivas ?? 0} ciudades`}
          href="/admin/negocios"
          destacada
        />
        <Kpi icono={Users} etiqueta="Usuarios totales" valor={String(tablero.usuarios)} nota="Cuentas registradas" href="/admin/auditoria" />
        <Kpi
          icono={CalendarDays}
          etiqueta="Reservas (14 días)"
          valor={String(tablero.totalReservas14)}
          nota={`${r?.citasCompletadasMes ?? 0} citas completadas este mes`}
          href="/admin/libro"
        />
        <Kpi icono={Layers} etiqueta="Ingresos mensuales (MRR)" valor={formatCOP(r?.mrr ?? 0)} nota="Suscripciones activas" href="/admin/planes" />
      </div>

      {/* Gráfica + estado de negocios */}
      <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-3">
        <Caja destacada className="lg:col-span-2">
          <TituloCaja
            extra={
              <span className="hidden items-center gap-3 text-[11.5px] text-text-muted sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 bg-accent" aria-hidden /> Reservas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 bg-border-subtle" aria-hidden /> Cancelaciones
                </span>
              </span>
            }
          >
            Reservas y cancelaciones
          </TituloCaja>
          {tablero.totalReservas14 === 0 ? (
            <p className="px-5 py-14 text-center text-[13px] text-text-faint">Aún no hay reservas en los últimos 14 días.</p>
          ) : (
            <div className="flex gap-2 px-4 pb-4 pt-5 sm:px-5" role="img" aria-label={`Reservas por día: ${tablero.totalReservas14} reservas y ${tablero.totalCanceladas14} cancelaciones en 14 días`}>
              <div className="flex h-44 flex-col justify-between pb-6 text-right font-mono text-[10px] text-text-faint" aria-hidden>
                {escala.map((v, i) => (
                  <span key={i}>{v}</span>
                ))}
              </div>
              <div className="grid flex-1 items-end gap-1 sm:gap-2" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
                {tablero.reservas14.map((d, i) => (
                  <div key={d.dia} className="flex h-44 min-w-0 flex-col items-center justify-end gap-1" title={`${d.etiqueta}: ${d.reservas} reservas, ${d.canceladas} canceladas`}>
                    <div className="flex h-full w-full items-end justify-center gap-[2px]">
                      <span className="w-full max-w-4 bg-accent" style={{ height: `${(d.reservas / max) * 100}%` }} />
                      <span className="w-full max-w-4 bg-border-subtle" style={{ height: `${(d.canceladas / max) * 100}%` }} />
                    </div>
                    <span className={`h-5 truncate font-mono text-[9.5px] text-text-faint ${i % 2 === 1 ? "invisible sm:visible" : ""}`}>
                      {d.etiqueta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Caja>

        <Caja>
          <TituloCaja href="/admin/negocios">Estado de negocios</TituloCaja>
          <div className="flex flex-col items-center gap-5 px-4 pb-5 pt-4 sm:flex-row sm:px-5 lg:flex-col xl:flex-row">
            <div className="relative grid size-36 shrink-0 place-items-center rounded-full" style={{ background: dona }}>
              <div className="grid size-[104px] place-items-center rounded-full bg-bg text-center">
                <div>
                  <p className="font-display text-[30px] font-black leading-none text-text">{total}</p>
                  <p className="text-[11.5px] text-text-muted">Negocios</p>
                </div>
              </div>
            </div>
            <ul className="w-full space-y-2.5 text-[13px]">
              {[
                { color: "bg-accent", etiqueta: "Activos", n: est.ACTIVO },
                { color: "bg-border-subtle", etiqueta: "En revisión", n: est.PENDIENTE_APROBACION },
                { color: "bg-text-faint", etiqueta: "Suspendidos / otros", n: otros },
              ].map((f) => (
                <li key={f.etiqueta} className="flex items-center gap-2.5">
                  <span className={`size-3 shrink-0 ${f.color}`} aria-hidden />
                  <span className="flex-1 text-text">{f.etiqueta}</span>
                  <span className="font-mono font-bold text-text">{f.n}</span>
                  <span className="w-11 text-right font-mono text-text-faint">({pct(f.n)}%)</span>
                </li>
              ))}
            </ul>
          </div>
        </Caja>
      </div>

      {/* Tareas + actividad */}
      <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-2">
        <Caja destacada>
          <TituloCaja
            extra={
              tareas.length > 0 ? (
                <span className="grid size-6 place-items-center rounded-full bg-accent font-mono text-[11px] font-bold text-white">{tareas.length}</span>
              ) : undefined
            }
          >
            Tareas y alertas
          </TituloCaja>
          {tareas.length === 0 ? (
            <p className="flex items-center gap-2.5 px-5 py-8 text-[13px] text-text-muted">
              <CircleCheck className="size-5 text-success" aria-hidden /> Todo al día: no hay pendientes.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
              {tareas.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} className="flex min-h-14 items-center gap-3 py-3 hover:text-accent">
                    <t.icono className="size-5 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-text">{t.titulo}</span>
                      <span className="block truncate text-[12px] text-text-muted">{t.detalle}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-text-faint" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Caja>

        <Caja destacada>
          <TituloCaja href="/admin/auditoria">Actividad reciente</TituloCaja>
          {tablero.actividad.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-text-faint">Todavía no hay actividad registrada.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
              {tablero.actividad.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <Activity className="size-5 shrink-0 text-text" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-text">{a.titulo}</span>
                    <span className="block truncate text-[12px] text-text-muted">
                      {[a.detalle, haceCuanto(a.fecha)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Caja>
      </div>

      {/* Accesos rápidos */}
      <Caja destacada className="mt-4 sm:mt-5">
        <div className="flex flex-col gap-3 p-4 sm:p-5 xl:flex-row xl:items-center">
          <h2 className="shrink-0 font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-text xl:mr-4">Accesos rápidos</h2>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {accesos.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex min-h-11 items-center gap-2 border-2 border-border px-3 py-2 text-[12.5px] font-semibold text-text transition-colors hover:bg-text hover:text-bg"
              >
                <a.icono className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{a.etiqueta}</span>
              </Link>
            ))}
          </div>
        </div>
      </Caja>
    </main>
  );
}
