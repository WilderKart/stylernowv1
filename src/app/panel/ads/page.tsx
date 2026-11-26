import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { listarMisCampanas, obtenerSaldoPublicitario } from "./actions";
import { VistaAds } from "./vista-ads";

export const metadata = { title: "Publicidad" };

export default async function AdsPage() {
  // 06_Advertising_System.md + ADR-015: Ads es decisión de inversión del
  // negocio — Guardian queda completamente fuera del módulo (ver 01_Roles.md).
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/ads");

  const negocioId = contexto.negocioId!;
  const [campanasRes, saldoRes] = await Promise.all([listarMisCampanas(negocioId), obtenerSaldoPublicitario(negocioId)]);

  const supabase = await createClient();
  const { data: planOk, error: planErr } = await supabase.rpc("negocio_tiene_funcion", {
    p_negocio_id: negocioId,
    p_clave: "publicidad_extra",
  });
  const planInsuficiente = planErr ? false : !planOk;

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <VistaAds
        negocioId={negocioId}
        saldoInicial={saldoRes.ok ? saldoRes.data : { saldo: 0, paquetes: [] }}
        planInsuficiente={planInsuficiente}
        campanasIniciales={campanasRes.ok ? campanasRes.data : []}
        errorInicial={campanasRes.ok ? null : campanasRes.error}
      />
    </div>
  );
}
