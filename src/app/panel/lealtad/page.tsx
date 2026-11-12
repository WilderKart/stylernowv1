import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import {
  listarCampanasSellos,
  listarCuentasCorporativas,
  listarFamiliasNegocio,
  listarGiftCards,
  listarMiembrosVip,
  listarNivelesVip,
  listarPlanesMembresia,
  listarReglasCashback,
  listarReglasRecompensa,
  listarSugerenciasAction,
  obtenerConfigReferidos,
} from "./actions";
import { VistaLealtadPanel } from "./vista-lealtad-panel";

export const metadata = { title: "Lealtad" };

export default async function LealtadPanelPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/lealtad");

  const negocioId = contexto.negocioId!;

  // Funciones incluidas en el plan del negocio (la BD es la fuente de verdad; la RLS y las RPC también las exigen).
  const supabase = await createClient();
  const [{ data: tieneMembresias }, { data: tieneFidelizacion }, { data: negocioPlan }] = await Promise.all([
    supabase.rpc("negocio_tiene_funcion", { p_negocio_id: negocioId, p_clave: "membresias" }),
    supabase.rpc("negocio_tiene_funcion", { p_negocio_id: negocioId, p_clave: "fidelizacion" }),
    supabase.from("negocio").select("plan_codigo").eq("id", negocioId).maybeSingle(),
  ]);
  const planNombre = negocioPlan?.plan_codigo
    ? negocioPlan.plan_codigo.charAt(0) + negocioPlan.plan_codigo.slice(1).toLowerCase()
    : "actual";

  const [planes, giftCards, referidoConfig, campanasSellos, reglasCashback, nivelesVip, miembrosVip, familias, cuentasCorp, reglasRecompensa, sugerencias] = await Promise.all([
    listarPlanesMembresia(negocioId),
    listarGiftCards(negocioId),
    obtenerConfigReferidos(negocioId),
    listarCampanasSellos(negocioId),
    listarReglasCashback(negocioId),
    listarNivelesVip(negocioId),
    listarMiembrosVip(negocioId),
    listarFamiliasNegocio(negocioId),
    listarCuentasCorporativas(negocioId),
    listarReglasRecompensa(negocioId),
    listarSugerenciasAction(negocioId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaLealtadPanel
        negocioId={negocioId}
        funciones={{ membresias: tieneMembresias === true, fidelizacion: tieneFidelizacion === true }}
        planNombre={planNombre}
        planesIniciales={planes.ok ? planes.data : []}
        giftCardsIniciales={giftCards.ok ? giftCards.data : []}
        referidoConfigInicial={referidoConfig.ok ? referidoConfig.data : null}
        campanasSellosIniciales={campanasSellos.ok ? campanasSellos.data : []}
        reglasCashbackIniciales={reglasCashback.ok ? reglasCashback.data : []}
        nivelesVipIniciales={nivelesVip.ok ? nivelesVip.data : []}
        miembrosVipIniciales={miembrosVip.ok ? miembrosVip.data : []}
        familiasIniciales={familias.ok ? familias.data : []}
        cuentasCorpIniciales={cuentasCorp.ok ? cuentasCorp.data : []}
        reglasRecompensaIniciales={reglasRecompensa.ok ? reglasRecompensa.data : []}
        sugerenciasIniciales={sugerencias.ok ? sugerencias.data : []}
      />
    </div>
  );
}
