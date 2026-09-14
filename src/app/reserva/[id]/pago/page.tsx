import { BarraSuperior } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { PantallaPago } from "./pantalla-pago";

export const metadata = {
  title: "Pagar seña",
  robots: { index: false, follow: false },
};

export default async function PagoPage(props: PageProps<"/reserva/[id]/pago">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/reserva/${id}/pago`);

  // RLS `reserva_select_cliente` ya limita la fila al dueño de la Reserva.
  const { data: reserva } = await supabase
    .from("reserva")
    .select(
      `id, estado, hora_inicio, monto_total, monto_sena, expira_at,
       negocio:negocio_id (nombre, slug),
       sede:sede_id (zona_horaria),
       staff:staff_id (nombre),
       reserva_servicio (servicio:servicio_id (nombre))`
    )
    .eq("id", id)
    .maybeSingle();

  if (!reserva) notFound();

  // Una Reserva ya confirmada o cancelada no vuelve a la pantalla de cobro.
  if (reserva.estado !== "PENDIENTE_PAGO") redirect(`/reserva/${id}`);

  const negocio = reserva.negocio as unknown as { nombre: string; slug: string } | null;
  const sede = reserva.sede as unknown as { zona_horaria: string } | null;
  const staff = reserva.staff as unknown as { nombre: string } | null;
  const servicios = (reserva.reserva_servicio ?? []).map(
    (rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre ?? "Servicio"
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior
        titulo="Pagar seña"
        volverA={negocio ? `/negocio/${negocio.slug}/reservar` : "/"}
      />
      <PantallaPago
        resumen={{
          reservaId: reserva.id,
          negocio: negocio?.nombre ?? "StylerNow",
          servicios: servicios.join(" + "),
          profesional: staff?.nombre ?? "Profesional asignado",
          horaInicio: reserva.hora_inicio,
          zonaHoraria: sede?.zona_horaria ?? "America/Bogota",
          montoTotal: Number(reserva.monto_total),
          montoSena: Number(reserva.monto_sena),
          expiraAt: reserva.expira_at,
        }}
      />
    </div>
  );
}
