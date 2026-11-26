import { BarraSuperior } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioNuevaSede } from "./formulario-nueva-sede";
import { obtenerOfertaSedeExtra } from "../actions";
import { OfertaSedeExtra } from "../oferta-sede-extra";

export const metadata = { title: "Nueva sede" };

export default async function NuevaSedePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/panel/sedes/nueva");

  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, plan_codigo")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!negocio) redirect("/panel/onboarding");

  const [{ count: sedesActuales }, { data: plan }] = await Promise.all([
    supabase
      .from("sede")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", negocio.id)
      .eq("cerrada_permanente", false),
    supabase.from("plan").select("limite_sedes, nombre").eq("codigo", negocio.plan_codigo).single(),
  ]);
  // Límite efectivo = sedes del plan + sedes adicionales vigentes (de pago). La base lo calcula.
  const { data: limiteEfectivo } = await (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: number | null }> }).rpc("limite_sedes_negocio", { p_negocio_id: negocio.id });
  const limite = limiteEfectivo === undefined ? (plan?.limite_sedes ?? null) : limiteEfectivo;
  const oferta = await obtenerOfertaSedeExtra(negocio.id);

  const limiteAlcanzado = limite != null && (sedesActuales ?? 0) >= limite;

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <BarraSuperior titulo="Nueva sede" volverA="/panel/sedes" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        {limiteAlcanzado ? (
          <OfertaSedeExtra negocioId={negocio.id} oferta={oferta} planNombre={plan?.nombre ?? negocio.plan_codigo} limite={plan?.limite_sedes ?? null} modo="limite" />
        ) : (
          <FormularioNuevaSede negocioId={negocio.id} />
        )}
      </main>
    </div>
  );
}
