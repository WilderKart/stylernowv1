import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { PantallaCheckoutMembresia } from "./pantalla-checkout-membresia";

export const metadata = { title: "Comprar Membresía", robots: { index: false, follow: false } };

export default async function CheckoutMembresiaPage(props: PageProps<"/checkout/membresia/[planId]">) {
  const { planId } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/checkout/membresia/${planId}`);

  const { data: plan } = await supabase
    .from("membresia_plan")
    .select("id, nombre, precio, duracion_meses, negocio:negocio_id (nombre, slug)")
    .eq("id", planId)
    .eq("activo", true)
    .maybeSingle();
  if (!plan) notFound();

  const negocio = plan.negocio as unknown as { nombre: string; slug: string } | null;

  return (
    <Pantalla>
      <Top titulo="Comprar membresía" volverA={negocio ? `/negocio/${negocio.slug}/membresias/${plan.id}` : "/"} />
      <PantallaCheckoutMembresia
        resumen={{
          planId: plan.id,
          negocio: negocio?.nombre ?? "StylerNow",
          nombrePlan: plan.nombre,
          precio: Number(plan.precio),
          duracionMeses: plan.duracion_meses,
        }}
      />
    </Pantalla>
  );
}
