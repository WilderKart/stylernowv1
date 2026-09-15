import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { listarMovimientosWallet, obtenerMiWallet } from "./actions";
import { VistaWallet } from "./vista-wallet";

export const metadata = { title: "Mi Wallet" };

export default async function WalletPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/wallet");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // 08-Growth-Monetization/02_Commissions.md, Permisos: "Barbería ve el
  // detalle completo de comisión de plataforma retenida" — Guardian/Staff
  // no tienen mención de acceso al detalle del Wallet.
  if (contexto.rol !== "BARBERIA") redirect("/panel");

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
