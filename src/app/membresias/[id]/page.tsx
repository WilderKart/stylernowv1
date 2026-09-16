import { BarraSuperior } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { VistaMiMembresia } from "./vista-mi-membresia";

export const metadata = { title: "Mi Membresía" };

export default async function MiMembresiaPage(props: PageProps<"/membresias/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/membresias/${id}`);

  const { data: membresia } = await supabase
    .from("cliente_membresia")
    .select(
      "id, estado, fecha_inicio, fecha_proximo_cobro, congelada_hasta, usos_mes_actual, usos_mes_fecha, plan:plan_id (nombre, precio, duracion_meses, descuento_pct, limite_usos_mes, congelacion_max_dias, prioridad_reserva, regalo_cumpleanos, servicio_ids), negocio:negocio_id (nombre, slug)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!membresia) notFound();
  // RLS ya limita la fila al dueño o al Negocio — si llegó acá con otro
  // usuario, la fila simplemente no existió (comportamiento normal de RLS).

  const negocio = membresia.negocio as unknown as { nombre: string; slug: string } | null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Mi Membresía" volverA="/membresias" />
      <VistaMiMembresia membresia={membresia} negocioNombre={negocio?.nombre ?? "StylerNow"} />
    </div>
  );
}
