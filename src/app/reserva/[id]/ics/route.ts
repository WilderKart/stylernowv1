import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

/** Escapa los caracteres con significado propio en un campo de texto iCalendar. */
function escapar(texto: string) {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function aUtc(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * GET /reserva/{id}/ics — "Agregar a calendario" de la pantalla de confirmación
 * (02-UX/06_Payments.md). RLS limita la fila al dueño de la Reserva.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/reserva/[id]/ics">) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  const { data: reserva } = await supabase
    .from("reserva")
    .select(
      `id, estado, hora_inicio, hora_fin,
       negocio:negocio_id (nombre),
       sede:sede_id (nombre, direccion, ciudad),
       reserva_servicio (servicio:servicio_id (nombre))`
    )
    .eq("id", id)
    .maybeSingle();

  if (!reserva) return new Response("Reserva no encontrada", { status: 404 });

  const negocio = (reserva.negocio as unknown as { nombre: string } | null)?.nombre ?? "StylerNow";
  const sede = reserva.sede as unknown as {
    nombre: string;
    direccion: string;
    ciudad: string;
  } | null;
  const servicios = (reserva.reserva_servicio ?? [])
    .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
    .filter(Boolean)
    .join(" + ");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StylerNow//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${reserva.id}@stylernow`,
    `DTSTAMP:${aUtc(new Date().toISOString())}`,
    `DTSTART:${aUtc(reserva.hora_inicio)}`,
    `DTEND:${aUtc(reserva.hora_fin)}`,
    `SUMMARY:${escapar(`${servicios || "Cita"} · ${negocio}`)}`,
    sede
      ? `LOCATION:${escapar(`${sede.nombre}, ${sede.direccion}, ${sede.ciudad}`)}`
      : null,
    `DESCRIPTION:${escapar(`Tu cita en ${negocio}. Reserva ${reserva.id}.`)}`,
    // Recordatorio 2 horas antes, dentro de la ventana de cancelación por defecto.
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapar(`Tu cita en ${negocio} es en 2 horas`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="stylernow-${reserva.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
