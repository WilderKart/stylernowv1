import { BarraSuperior } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { FlujoReserva } from "./flujo-reserva";

export const metadata = {
  title: "Reservar turno",
  // El flujo depende de la sesión y de disponibilidad en vivo: no debe indexarse.
  robots: { index: false, follow: false },
};

export default async function ReservarPage(props: PageProps<"/negocio/[slug]/reservar">) {
  const { slug } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 02-UX/05_Booking.md: exclusivo de Cliente autenticado, no existe modo invitado.
  if (!user) redirect(`/login?next=/negocio/${slug}/reservar`);

  const { data: negocio } = await supabase
    .from("negocio")
    .select(
      "id, nombre, slug, pago_completo_en_app, sena_pct, sena_monto_fijo, sena_minimo, sena_maximo, ventana_reembolso_total_horas, ventana_reembolso_parcial_horas, reembolso_parcial_pct"
    )
    .eq("slug", slug)
    .eq("estado", "ACTIVO")
    .maybeSingle();

  if (!negocio) notFound();

  const [{ data: sedes }, { data: servicios }, { data: staff }] = await Promise.all([
    supabase
      .from("sede")
      .select("id, nombre, direccion, zona_horaria")
      .eq("negocio_id", negocio.id)
      .eq("cerrada_permanente", false)
      .eq("cerrada_temporalmente", false)
      .order("created_at"),
    supabase
      .from("servicio")
      .select("id, nombre, descripcion, duracion_minutos, precio_base")
      .eq("negocio_id", negocio.id)
      .eq("estado", "ACTIVO")
      .order("precio_base"),
    supabase.rpc("negocio_staff_publico", { p_negocio_id: negocio.id }),
  ]);

  if (!sedes?.length || !servicios?.length) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg">
        <BarraSuperior titulo={negocio.nombre} volverA={`/negocio/${slug}`} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-semibold text-text">Este negocio aún no acepta reservas</p>
          <p className="mt-1 max-w-[300px] text-xs text-text-faint">
            Le falta publicar sus servicios o su sede. Volvé a intentarlo más tarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo={negocio.nombre} volverA={`/negocio/${slug}`} />
      <FlujoReserva
        negocio={negocio}
        sedes={sedes}
        servicios={servicios}
        staff={(staff ?? []).map((p) => ({ ...p, nivel: p.nivel }))}
      />
    </div>
  );
}
