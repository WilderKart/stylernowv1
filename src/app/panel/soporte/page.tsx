import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { listarMisTickets } from "./actions";
import { obtenerChatSoporte } from "./chat-actions";
import { VistaSoporte } from "./vista-soporte";

export const metadata = { title: "Soporte" };

export default async function SoportePage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/soporte");

  const [res, chat] = await Promise.all([listarMisTickets(), obtenerChatSoporte()]);

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <VistaSoporte
        negocioId={contexto.negocioId!}
        ticketsIniciales={res.ok ? res.data : []}
        errorInicial={res.ok ? null : res.error}
        chatInicial={chat.ok ? chat.data : null}
        errorChatInicial={chat.ok ? null : chat.error}
      />
    </div>
  );
}
