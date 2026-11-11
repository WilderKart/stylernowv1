import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { listarMovimientosWallet, obtenerMiWallet } from "./actions";
import { VistaWallet } from "./vista-wallet";

export const metadata = { title: "Mi Wallet" };

export default async function WalletPage() {
  // 08-Growth-Monetization/02_Commissions.md: "Barbería ve el detalle
  // completo de comisión de plataforma retenida" — Guardian/Staff no.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/wallet");

  const negocioId = contexto.negocioId!;
  const [walletRes, movimientosRes] = await Promise.all([obtenerMiWallet(negocioId), listarMovimientosWallet(negocioId)]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaWallet
        walletInicial={walletRes.ok ? walletRes.data : { saldoDisponible: 0, saldoRetenido: 0 }}
        movimientosIniciales={movimientosRes.ok ? movimientosRes.data : []}
      />
    </div>
  );
}
