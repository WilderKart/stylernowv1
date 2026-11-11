import {
  Bloque,
  diaYMes,
  EstadoReservaStatus,
  Fila,
  Filas,
  horaCorta,
  Pantalla,
  Pie,
  Sec,
  TicketCita,
  Top,
} from "@/app/lealtad/ui-cliente";
import { Marquee, Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { duracion, fechaHoraLarga } from "@/lib/formato";
import { obtenerDetalleCita } from "@/lib/cliente/citas";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import { CalendarPlus, Check, Clock, MapPin, MessageSquare, Navigation, Receipt, Star, Store, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BotonLlegue, FilaCompartir, Reprogramar } from "./acciones-cita";
import { BotonCancelar } from "./boton-cancelar";

export const metadata = {
  title: "Tu reserva",
  robots: { index: false, follow: false },
};

const TITULO = {
  PENDIENTE_PAGO: "Falta pagar el anticipo",
  CONFIRMADA: "Turno confirmado",
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

/** "EN 1 H 04 MIN" hasta la cita, o null si ya empezó. */
function cuentaAtras(horaInicio: string) {
  const m = Math.floor((new Date(horaInicio).getTime() - Date.now()) / 60_000);
  if (m <= 0) return null;
  if (m >= 1440) return `EN ${Math.floor(m / 1440)} D ${Math.floor((m % 1440) / 60)} H`;
  return `EN ${Math.floor(m / 60)} H ${String(m % 60).padStart(2, "0")} MIN`;
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

  const dm = diaYMes(reserva.hora_inicio, tz);
  const hora = horaCorta(reserva.hora_inicio, tz);
  const horaFin = horaCorta(reserva.hora_fin, tz);
  const nombresServicios =
    servicios
      .map((s) => s?.nombre)
      .filter(Boolean)
      .join(" + ") || "Servicio";
  const recienConfirmada = confirmada && query.desde === "pago";
  const saldoLocal = Number(reserva.monto_total) - Number(reserva.monto_sena);

  // Datos de las acciones (C03): permisos, coordenadas y chat salen de la RPC mi_cita_detalle.
  // Si falla, la pantalla sigue mostrando el detalle básico sin las acciones extra.
  const det = await obtenerDetalleCita(id);
  const cita = det.ok ? det.data : null;
  const cuentaRegresiva = confirmada ? cuentaAtras(reserva.hora_inicio) : null;
  const destinoMapa =
    cita?.sede.latitud != null && cita.sede.longitud != null
      ? `${cita.sede.latitud},${cita.sede.longitud}`
      : sede
        ? [sede.nombre, sede.direccion].filter(Boolean).join(", ")
        : null;
  const enlaceMapa = destinoMapa
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinoMapa)}`
    : null;
  const textoCompartir = [
    `${nombresServicios} en ${negocio?.nombre ?? "StylerNow"}`,
    `${fechaHoraLarga(reserva.hora_inicio, tz)}`,
    sede ? `${sede.nombre} · ${sede.direccion}` : null,
    enlaceMapa,
  ]
    .filter(Boolean)
    .join("\n");
  const activa = reserva.estado === "CONFIRMADA" || reserva.estado === "EN_CURSO";

  return (
    <Pantalla className="pb-10">
      {recienConfirmada ? (
        <>
          <div className="sn-block-signal !bg-signal !text-ink border-b-2 border-ink px-4 pt-5 pb-6">
            <span className="sn-num !text-ink">00 / Listo</span>
            <h1 className="poster-1 mt-2.5 break-words">
              Reserva
              <br />
              hecha.
            </h1>
          </div>
          <Marquee text={`Nos vemos el ${dm.dia} ${dm.mes} a las ${hora} ✶ Llega 5 minutos antes ✶ Tu profesional ya te espera`} tone="ink" />
        </>
      ) : (
        <Top titulo="Detalle de cita" volverA="/mis-reservas" />
      )}

      <div className="p-4">
        {!recienConfirmada ? <h1 className="poster-3 mb-4 break-words">{TITULO[reserva.estado]}</h1> : null}
        <TicketCita
          dia={dm.dia}
          mes={dm.mes}
          estado={<EstadoReservaStatus estado={reserva.estado} />}
          titulo={nombresServicios}
          lineas={[cita ? `Ticket ${cita.codigo}` : null, `${staff?.nombre ?? "Por asignar"} · ${hora} – ${horaFin}`, negocio?.nombre ?? "—"].filter((l): l is string => Boolean(l))}
          pie={
            <>
              <span className="sn-label">{confirmada ? "Anticipo pagada" : "Anticipo"}</span>
              <span className="sn-price">{formatCOP(Number(reserva.monto_sena))}</span>
            </>
          }
        />
        {reserva.estado === "CANCELADA" ? (
          <p className="body-sm mt-4 break-words">
            {MOTIVOS[reserva.cancelado_motivo as keyof typeof MOTIVOS] ??
              (reserva.cancelado_por === "NEGOCIO"
                ? "El negocio canceló la cita. Te devolvemos el 100% del anticipo."
                : "La reserva quedó cancelada.")}
          </p>
        ) : null}
      </div>

      {cuentaRegresiva ? (
        <div role="status" className="mx-4 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-2 border-border p-3">
          <Clock aria-hidden className="size-5 shrink-0" />
          <span className="sn-label">{cuentaRegresiva}</span>
          <span className="sn-meta">Llega 5 minutos antes.</span>
        </div>
      ) : null}

      {cita?.puede_llegue || (cita?.checkin_at && activa) ? (
        <div className="px-4 pb-4">
          <BotonLlegue reservaId={reserva.id} checkinAt={cita.checkin_at} tz={tz} />
        </div>
      ) : null}

      <Filas>
        <Fila
          icono={<Store aria-hidden className="size-5" />}
          titulo={negocio?.nombre ?? "—"}
          meta={`${servicios.length > 1 ? "Servicios" : "Servicio"} · ${duracion(minutos)}`}
          href={negocio ? `/negocio/${negocio.slug}` : undefined}
        />
        {sede ? (
          <Fila icono={<MapPin aria-hidden className="size-5" />} titulo="Dónde" meta={`${sede.nombre} · ${sede.direccion}`} />
        ) : null}
        <Fila
          icono={<Clock aria-hidden className="size-5" />}
          titulo="Cuándo"
          meta={<span className="capitalize">{fechaHoraLarga(reserva.hora_inicio, tz)}</span>}
        />
        <Fila
          icono={<Receipt aria-hidden className="size-5" />}
          titulo="Total del servicio"
          derecha={<span className="sn-price">{formatCOP(Number(reserva.monto_total))}</span>}
        />
        <Fila
          icono={<Wallet aria-hidden className="size-5" />}
          titulo="Anticipo"
          meta={confirmada && saldoLocal > 0 ? `Pagas ${formatCOP(saldoLocal)} en el local al terminar` : undefined}
          derecha={
            <>
              <span className="sn-price">{formatCOP(Number(reserva.monto_sena))}</span>
              <Status tone={confirmada ? "ok" : "warn"} icon={confirmada ? <Check aria-hidden className="size-3.5" /> : undefined}>
                {confirmada ? "Pagada" : "Pendiente"}
              </Status>
            </>
          }
        />
        {confirmada ? (
          <Fila
            icono={<CalendarPlus aria-hidden className="size-5" />}
            titulo="Agregar al calendario"
            meta="Google, Apple, Outlook"
            href={`/reserva/${reserva.id}/ics`}
            external
          />
        ) : null}
        {cita?.puede_reprogramar ? <Reprogramar reservaId={reserva.id} tz={tz} /> : null}
        {activa && enlaceMapa ? (
          <Fila icono={<Navigation aria-hidden className="size-5" />} titulo="Cómo llegar" meta="Abre la ruta en tu app de mapas" href={enlaceMapa} external />
        ) : null}
        {activa ? <FilaCompartir texto={textoCompartir} /> : null}
        {cita && reserva.estado !== "PENDIENTE_PAGO" && reserva.estado !== "CANCELADA" ? (
          <Fila
            icono={<MessageSquare aria-hidden className="size-5" />}
            titulo="Escribir al negocio"
            meta={cita.chat_habilitado ? "Chat de esta cita" : "El chat de esta cita ya está cerrado"}
            href={cita.chat_habilitado ? `/reserva/${reserva.id}/chat` : undefined}
          />
        ) : null}
        {cita?.puede_calificar ? (
          <Fila icono={<Star aria-hidden className="size-5" />} titulo="Calificar la visita" meta="Cuéntanos cómo te fue" href={`/reserva/${reserva.id}/calificar`} />
        ) : cita?.ya_califico ? (
          <Fila icono={<Check aria-hidden className="size-5" />} titulo="Ya calificaste esta visita" meta="Gracias por tu reseña" />
        ) : null}
        {confirmada ? (
          <BotonCancelar reservaId={reserva.id} reembolsoEstimado={reembolsoEstimado} reembolsoPct={pct} />
        ) : null}
      </Filas>

      {confirmada ? (
        <Bloque etiqueta="00 / Política">
          {pct === 0
            ? "Estás dentro de la ventana sin reembolso: si cancelas ahora, el anticipo queda para el negocio."
            : `Si cancelas ahora te devolvemos ${formatCOP(reembolsoEstimado)} (${pct}% del anticipo).`}
        </Bloque>
      ) : null}

      {reserva.estado === "PENDIENTE_PAGO" ? (
        <Pie>
          <Button asChild size="lg" className="w-full">
            <Link href={`/reserva/${reserva.id}/pago`}>Pagar anticipo y confirmar</Link>
          </Button>
        </Pie>
      ) : null}

      {reserva.estado === "CANCELADA" && negocio ? (
        <>
          <Sec>01 / Siguiente</Sec>
          <div className="px-4">
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href={`/negocio/${negocio.slug}/reservar`}>Buscar otro horario</Link>
            </Button>
          </div>
        </>
      ) : null}

      {recienConfirmada ? (
        <div className="flex flex-col gap-3 p-4">
          <Button asChild size="lg" className="w-full">
            <Link href="/mis-reservas">Ver mis citas</Link>
          </Button>
        </div>
      ) : null}
    </Pantalla>
  );
}
