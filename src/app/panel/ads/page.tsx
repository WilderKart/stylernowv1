import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { listarMisCampanas } from "./actions";
import { VistaAds } from "./vista-ads";

export const metadata = { title: "Publicidad" };

export default async function AdsPage() {
  // 06_Advertising_System.md + ADR-015: Ads es decisión de inversión del
  // negocio — Guardian queda completamente fuera del módulo (ver 01_Roles.md).
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/ads");

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
