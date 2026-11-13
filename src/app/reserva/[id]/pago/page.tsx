import { resumenPoliticaCancelacion } from "@/lib/pagos/sena";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { PantallaPago } from "./pantalla-pago";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("pago.meta"), robots: { index: false, follow: false } };
}

export default async function PagoPage(props: PageProps<"/reserva/[id]/pago">) {
  const { id } = await props.params;
  const t = await obtenerT();
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
       negocio:negocio_id (nombre, slug, ventana_reembolso_total_horas, ventana_reembolso_parcial_horas, reembolso_parcial_pct, anticipo_modo),
       sede:sede_id (zona_horaria),
       staff:staff_id (nombre),
       reserva_servicio (servicio:servicio_id (nombre))`
    )
    .eq("id", id)
    .maybeSingle();

  if (!reserva) notFound();

  // Una Reserva ya confirmada o cancelada no vuelve a la pantalla de cobro.
  if (reserva.estado !== "PENDIENTE_PAGO") redirect(`/reserva/${id}`);

  const negocio = reserva.negocio as unknown as {
    nombre: string;
    slug: string;
    ventana_reembolso_total_horas: number;
    ventana_reembolso_parcial_horas: number;
    reembolso_parcial_pct: number;
    anticipo_modo?: string;
  } | null;
  const sede = reserva.sede as unknown as { zona_horaria: string } | null;
  const staff = reserva.staff as unknown as { nombre: string } | null;
  const servicios = (reserva.reserva_servicio ?? []).map(
    (rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre ?? t("rv.servicio")
  );

  return (
    <PantallaPago
      volverA={negocio ? `/negocio/${negocio.slug}/reservar` : "/"}
      resumen={{
        reservaId: reserva.id,
        negocio: negocio?.nombre ?? "StylerNow",
        servicios: servicios.join(" + "),
        profesional: staff?.nombre ?? t("pago.profesional_asignado"),
        horaInicio: reserva.hora_inicio,
        zonaHoraria: sede?.zona_horaria ?? "America/Bogota",
        montoTotal: Number(reserva.monto_total),
        montoSena: Number(reserva.monto_sena),
        expiraAt: reserva.expira_at,
        // Solo para mostrar: lo que queda como evidencia lo reconstruye la base de datos
        // (`aceptar_politica_reserva`) con los números del negocio, no este texto.
        politica: negocio ? resumenPoliticaCancelacion(negocio) : [],
        // Solo para mostrar el botón; la base lo vuelve a verificar al confirmar.
        anticipoOpcional: negocio?.anticipo_modo === "OPCIONAL",
      }}
    />
  );
}
