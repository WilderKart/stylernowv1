import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listarMisCampanas } from "./actions";
import { VistaAds } from "./vista-ads";

export const metadata = { title: "Publicidad" };

export default async function AdsPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/ads");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // 06_Advertising_System.md, Permisos: "Barbería (Plan Jarl+) crea y
  // gestiona sus propias campañas" — Guardian/Staff no tienen mención.
  if (contexto.rol !== "BARBERIA") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const supabase = await createClient();
  const [{ data: negocio }, campanasRes] = await Promise.all([
    supabase.from("negocio").select("plan_codigo").eq("id", negocioId).single(),
    listarMisCampanas(negocioId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaAds
        negocioId={negocioId}
        planInsuficiente={negocio?.plan_codigo === "RAVEN"}
        campanasIniciales={campanasRes.ok ? campanasRes.data : []}
        errorInicial={campanasRes.ok ? null : campanasRes.error}
      />
    </div>
  );
}
