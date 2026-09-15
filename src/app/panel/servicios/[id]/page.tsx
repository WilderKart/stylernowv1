import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { listarStaffAsignable } from "../actions";
import { DetalleServicio } from "./detalle-servicio";

export const metadata = { title: "Detalle de servicio" };

export default async function ServicioDetallePage(props: PageProps<"/panel/servicios/[id]">) {
  const { id } = await props.params;
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect(`/login?next=/panel/servicios/${id}`);
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const supabase = await createClient();
  const { data: servicio } = await supabase
    .from("servicio")
    .select(
      "id, negocio_id, nombre, descripcion, duracion_minutos, precio_base, categoria_puntaje, buffer_previo_minutos, buffer_posterior_minutos, estado"
    )
    .eq("id", id)
    .maybeSingle();
  if (!servicio) notFound();
  if (servicio.negocio_id !== contexto.negocioId) notFound();

  const resStaff = contexto.permisos.asignarStaffServicio
    ? await listarStaffAsignable(servicio.negocio_id, servicio.id)
    : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-16">
      <BarraSuperior titulo={servicio.nombre} volverA="/panel/servicios" />
      <DetalleServicio
        servicio={servicio}
        permisos={contexto.permisos}
        staffAsignableInicial={resStaff?.ok ? resStaff.data : []}
      />
    </div>
  );
}
