import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { VistaMiMembresia } from "./vista-mi-membresia";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("mm.meta_una") };
}

export default async function MiMembresiaPage(props: PageProps<"/membresias/[id]">) {
  const { id } = await props.params;
  const t = await obtenerT();
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
  // RLS ya limita la fila al dueño o al Negocio — si llegó aquí con otro
  // usuario, la fila simplemente no existió (comportamiento normal de RLS).

  const negocio = membresia.negocio as unknown as { nombre: string; slug: string } | null;

  return (
    <Pantalla>
      <Top titulo={t("mm.top_una")} volverA="/membresias" />
      <VistaMiMembresia membresia={membresia} negocioNombre={negocio?.nombre ?? "StylerNow"} />
    </Pantalla>
  );
}
