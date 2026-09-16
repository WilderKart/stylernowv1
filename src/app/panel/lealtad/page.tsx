import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
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
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/lealtad");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol !== "BARBERIA") redirect("/panel");

  const negocioId = contexto.negocioId!;

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
