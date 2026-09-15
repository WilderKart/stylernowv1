import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { DetalleCombo } from "./detalle-combo";

export const metadata = { title: "Detalle de combo" };

export default async function ComboDetallePage(props: PageProps<"/panel/servicios/combos/[id]">) {
  const { id } = await props.params;
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect(`/login?next=/panel/servicios/combos/${id}`);
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const supabase = await createClient();
  const { data: combo } = await supabase
    .from("servicio_combo")
    .select("id, negocio_id, nombre, descripcion, precio_total_override, duracion_minutos_override, estado")
    .eq("id", id)
    .maybeSingle();
  if (!combo) notFound();
  if (combo.negocio_id !== contexto.negocioId) notFound();

  const [{ data: items }, { data: servicios }] = await Promise.all([
    supabase.from("servicio_combo_item").select("servicio_id").eq("combo_id", id),
    supabase
      .from("servicio")
      .select("id, nombre, duracion_minutos, precio_base")
      .eq("negocio_id", combo.negocio_id)
      .eq("estado", "ACTIVO")
      .order("nombre"),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-16">
      <BarraSuperior titulo={combo.nombre} volverA="/panel/servicios" />
      <DetalleCombo
        combo={combo}
        servicios={servicios ?? []}
        servicioIdsIniciales={(items ?? []).map((i) => i.servicio_id)}
        puedeGestionar={contexto.permisos.gestionarCombos}
      />
    </div>
  );
}
