import { BarraSuperior } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioNuevaSede } from "./formulario-nueva-sede";

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

  const limiteAlcanzado = plan?.limite_sedes != null && (sedesActuales ?? 0) >= plan.limite_sedes;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Nueva sede" volverA="/panel/sedes" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        {limiteAlcanzado ? (
          <div className="rounded-2xl border border-danger/40 bg-danger-soft p-4">
            <p className="text-[13.5px] font-bold text-text">
              Tu plan {plan?.nombre} permite hasta {plan?.limite_sedes} sede
              {plan?.limite_sedes === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-[12.5px] text-text-muted">
              Hacé un upgrade de plan para agregar otra sede
              (01-PRD/03_Monetization.md).
            </p>
          </div>
        ) : (
          <FormularioNuevaSede negocioId={negocio.id} />
        )}
      </main>
    </div>
  );
}
