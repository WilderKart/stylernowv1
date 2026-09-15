import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { listarMisTickets } from "./actions";
import { VistaSoporte } from "./vista-soporte";

export const metadata = { title: "Soporte" };

export default async function SoportePage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/soporte");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const res = await listarMisTickets();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaSoporte negocioId={contexto.negocioId!} ticketsIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </div>
  );
}
