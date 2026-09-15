import type { CitaDelDia, RankingStaffItem, ResumenDia } from "@/app/panel/dashboard-actions";
import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";

const ESTADO_CITA_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  PENDIENTE_PAGO: "neutral",
  CONFIRMADA: "accent",
  EN_CURSO: "success",
  COMPLETADA: "success",
  NO_SHOW: "danger",
};

const ESTADO_CITA_TEXTO: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  NO_SHOW: "No se presentó",
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

/**
 * Resumen del día del Panel Negocio (Módulo 2.2, `02-UX/09_Business_
 * Panel.md`). Puramente presentacional — el alcance (todo el negocio para
 * Barbería, una sola sede para Guardian) ya viene resuelto en los datos que
 * recibe, calculados server-side por `dashboard_resumen_dia()` /
 * `dashboard_ranking_staff_semana()` (migración 016).
 */
export function DashboardResumen({
  resumen,
  ranking,
  timeline,
  erroresParciales,
}: {
  resumen: ResumenDia | null;
  ranking: RankingStaffItem[];
  timeline: CitaDelDia[];
  /** Alguna de las 3 consultas falló — no rompemos toda la pantalla por eso. */
  erroresParciales: string[];
}) {
  return (
    <div className="mt-2 flex flex-col gap-6">
      {erroresParciales.length > 0 ? (
        <p role="alert" className="text-[12px] font-semibold text-danger">
          {erroresParciales.join(" · ")}
        </p>
      ) : null}

      {resumen ? (
        <section className="grid grid-cols-3 gap-2.5">
          <Card className="items-center text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
              Citas de hoy
            </p>
            <p className="mt-1 text-[20px] font-bold text-text">{resumen.citasHoy}</p>
          </Card>
          <Card className="items-center text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
              Ingresos de hoy
            </p>
            <p className="mt-1 text-[15px] font-bold text-text">{formatCOP(resumen.ingresosHoy)}</p>
          </Card>
          <Card className="items-center text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Ocupación</p>
            <p className="mt-1 text-[20px] font-bold text-text">
              {resumen.ocupacionPct != null ? `${resumen.ocupacionPct}%` : "—"}
            </p>
          </Card>
        </section>
      ) : null}

      {resumen?.proximaCita ? (
        <Card className="border-accent/30 bg-accent-soft">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-accent">
            Próxima cita
          </p>
          <p className="mt-1 text-[14px] font-bold text-text">{hora(resumen.proximaCita.horaInicio)}</p>
          {resumen.proximaCita.staffNombre ? (
            <p className="text-[12px] text-text-muted">Con {resumen.proximaCita.staffNombre}</p>
          ) : null}
        </Card>
      ) : resumen ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-4 text-center text-[12px] text-text-faint">
          Sin citas confirmadas próximas.
        </p>
      ) : null}

      <section>
        <h2 className="font-display mb-3 text-[15px] font-bold uppercase text-text">
          Agenda de hoy
        </h2>
        {timeline.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
            No hay citas agendadas para hoy.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {timeline.map((c) => (
              <li key={c.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-text">
                      {hora(c.horaInicio)}–{hora(c.horaFin)} · {c.clienteNombre}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-text-faint">
                      {c.servicios || "Sin servicio registrado"}
                      {c.staffNombre ? ` · ${c.staffNombre}` : ""}
                    </p>
                  </div>
                  <Badge tone={ESTADO_CITA_TONO[c.estado] ?? "neutral"}>
                    {ESTADO_CITA_TEXTO[c.estado] ?? c.estado}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display mb-3 text-[15px] font-bold uppercase text-text">
          Ranking de Staff — esta semana
        </h2>
        {ranking.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
            Todavía no hay Reservas completadas esta semana.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ranking.map((r, i) => (
              <li key={r.vinculoId}>
                <Link
                  href={`/panel/staff/${r.vinculoId}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5 transition-colors hover:border-accent/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-text-muted">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-text">{r.nombre}</p>
                      <p className="text-[11px] text-text-faint">
                        {r.reservasCompletadas} reserva{r.reservasCompletadas === 1 ? "" : "s"} completada
                        {r.reservasCompletadas === 1 ? "" : "s"}
                        {r.sedeNombre ? ` · ${r.sedeNombre}` : ""}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-[13px] font-bold text-text">{formatCOP(r.comisionGenerada)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
