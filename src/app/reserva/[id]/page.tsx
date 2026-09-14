import { BarraSuperior } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { duracion, fechaHoraLarga } from "@/lib/formato";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BotonCancelar } from "./boton-cancelar";

export const metadata = {
  title: "Tu reserva",
  robots: { index: false, follow: false },
};

const TITULO = {
  PENDIENTE_PAGO: "Falta pagar la seña",
  CONFIRMADA: "¡Turno confirmado!",
  EN_CURSO: "Tu cita está en curso",
  COMPLETADA: "Cita completada",
  CANCELADA: "Reserva cancelada",
  NO_SHOW: "No asististe a la cita",
} as const;

const MOTIVOS = {
  PAGO_EXPIRADO: "No se completó el pago dentro de los 10 minutos y el horario se liberó.",
  PAGO_RECHAZADO: "La pasarela rechazó el pago, así que el horario volvió a estar disponible.",
} as const;

/**
 * Anticipa lo que devolvería una cancelación ahora. Es el mismo cálculo de ventana que
 * hace `cancelar_reserva`; la cifra que manda sigue siendo la de la base de datos.
 */
function estimarReembolso(
  horaInicio: string,
  montoSena: number,
  negocio: {
    ventana_reembolso_total_horas: number;
    ventana_reembolso_parcial_horas: number;
    reembolso_parcial_pct: number;
  } | null
) {
  if (!negocio) return { pct: 0, monto: 0 };

  const horasFaltantes = (new Date(horaInicio).getTime() - Date.now()) / 3_600_000;
  const pct =
    horasFaltantes >= negocio.ventana_reembolso_total_horas
      ? 100
      : horasFaltantes >= negocio.ventana_reembolso_parcial_horas
        ? negocio.reembolso_parcial_pct
        : 0;

  return { pct, monto: Math.round((montoSena * pct) / 100) };
}

async function cargar(id: string) {
  const supabase = await createClient();
  return supabase
    .from("reserva")
    .select(
      `id, estado, hora_inicio, hora_fin, monto_total, monto_sena, cancelado_por, cancelado_motivo,
       negocio:negocio_id (nombre, slug, ventana_reembolso_total_horas, ventana_reembolso_parcial_horas, reembolso_parcial_pct),
       sede:sede_id (nombre, direccion, zona_horaria),
       staff:staff_id (nombre),
       reserva_servicio (servicio:servicio_id (nombre, duracion_minutos))`
    )
    .eq("id", id)
    .maybeSingle();
}

export default async function ReservaPage(props: PageProps<"/reserva/[id]">) {
  const { id } = await props.params;
  const query = await props.searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/reserva/${id}`);

  // Vuelta del checkout: se reconcilia contra la pasarela antes de pintar, para que el
  // Cliente no vea "pendiente" cuando el pago ya se aprobó y el webhook aún no llegó.
  if (query.desde === "pago") {
    const { data: pagos } = await supabase
      .from("pago")
      .select("id, estado")
      .eq("reserva_id", id)
      .eq("tipo", "SENA")
      .order("created_at", { ascending: false })
      .limit(1);

    if (pagos?.[0]?.estado === "PENDIENTE") {
      try {
        await sincronizarPago(pagos[0].id);
      } catch (e) {
        console.error("[reserva] no se pudo reconciliar el pago", e);
      }
    }
  }

  const { data: reserva } = await cargar(id);
  if (!reserva) notFound();

  const negocio = reserva.negocio as unknown as {
    nombre: string;
    slug: string;
    ventana_reembolso_total_horas: number;
    ventana_reembolso_parcial_horas: number;
    reembolso_parcial_pct: number;
  } | null;
  const sede = reserva.sede as unknown as {
    nombre: string;
    direccion: string;
    zona_horaria: string;
  } | null;
  const staff = reserva.staff as unknown as { nombre: string } | null;
  const servicios = (reserva.reserva_servicio ?? []).map(
    (rs) => rs.servicio as unknown as { nombre: string; duracion_minutos: number } | null
  );

  const tz = sede?.zona_horaria ?? "America/Bogota";
  const minutos = servicios.reduce((a, s) => a + (s?.duracion_minutos ?? 0), 0);
  const confirmada = reserva.estado === "CONFIRMADA";

  const { pct, monto: reembolsoEstimado } = estimarReembolso(
    reserva.hora_inicio,
    Number(reserva.monto_sena),
    negocio
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-10">
      <BarraSuperior titulo="Tu reserva" volverA="/mis-reservas" />

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        <div className="mb-6 text-center">
          {confirmada ? (
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success-soft">
              <svg
                viewBox="0 0 24 24"
                width="26"
                height="26"
                fill="none"
                stroke="#6fcf97"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </div>
          ) : null}
          <h1 className="font-display text-[24px] font-bold uppercase leading-tight text-text">
            {TITULO[reserva.estado]}
          </h1>
          {reserva.estado === "CANCELADA" ? (
            <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-relaxed text-text-muted">
              {MOTIVOS[reserva.cancelado_motivo as keyof typeof MOTIVOS] ??
                (reserva.cancelado_por === "NEGOCIO"
                  ? "El negocio canceló la cita. Te devolvemos el 100% de la seña."
                  : "La reserva quedó cancelada.")}
            </p>
          ) : null}
        </div>

        <dl className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[12.5px] text-text-muted">Negocio</dt>
            <dd className="text-right text-[13px] font-semibold text-text">
              {negocio ? (
                <Link href={`/negocio/${negocio.slug}`} className="hover:text-accent">
                  {negocio.nombre}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[12.5px] text-text-muted">Servicios</dt>
            <dd className="text-right text-[13px] font-semibold text-text">
              {servicios.map((s) => s?.nombre).join(" + ")}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[12.5px] text-text-muted">Profesional</dt>
            <dd className="text-[13px] font-semibold text-text">{staff?.nombre ?? "Por asignar"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[12.5px] text-text-muted">Cuándo</dt>
            <dd className="text-right text-[13px] font-semibold capitalize text-text">
              {fechaHoraLarga(reserva.hora_inicio, tz)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[12.5px] text-text-muted">Duración</dt>
            <dd className="text-[13px] font-semibold text-text">{duracion(minutos)}</dd>
          </div>
          {sede ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[12.5px] text-text-muted">Dónde</dt>
              <dd className="text-right text-[13px] font-semibold text-text">
                {sede.nombre}
                <span className="block text-[11.5px] font-normal text-text-faint">
                  {sede.direccion}
                </span>
              </dd>
            </div>
          ) : null}

          <div className="mt-1 border-t border-border-subtle pt-3">
            <div className="flex justify-between gap-3">
              <dt className="text-[12.5px] text-text-muted">Total del servicio</dt>
              <dd className="text-[13px] font-semibold text-text">
                {formatCOP(Number(reserva.monto_total))}
              </dd>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <dt className="text-[12.5px] text-text-muted">Seña</dt>
              <dd className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-text">
                  {formatCOP(Number(reserva.monto_sena))}
                </span>
                <Badge tone={confirmada ? "success" : "neutral"}>
                  {confirmada ? "PAGADA" : "PENDIENTE"}
                </Badge>
              </dd>
            </div>
            {confirmada && Number(reserva.monto_sena) < Number(reserva.monto_total) ? (
              <p className="mt-1.5 text-[11.5px] text-text-faint">
                Pagás {formatCOP(Number(reserva.monto_total) - Number(reserva.monto_sena))} en el
                local al terminar.
              </p>
            ) : null}
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2.5">
          {reserva.estado === "PENDIENTE_PAGO" ? (
            <Button asChild size="lg" className="w-full">
              <Link href={`/reserva/${reserva.id}/pago`}>PAGAR SEÑA Y CONFIRMAR</Link>
            </Button>
          ) : null}

          {confirmada ? (
            <>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <a href={`/reserva/${reserva.id}/ics`}>AGREGAR A MI CALENDARIO</a>
              </Button>
              <BotonCancelar
                reservaId={reserva.id}
                reembolsoEstimado={reembolsoEstimado}
                reembolsoPct={pct}
              />
            </>
          ) : null}

          {reserva.estado === "CANCELADA" && negocio ? (
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href={`/negocio/${negocio.slug}/reservar`}>BUSCAR OTRO HORARIO</Link>
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
