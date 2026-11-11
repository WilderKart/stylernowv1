import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { notFound } from "next/navigation";
import { obtenerHiloTicket } from "../actions";
import { VistaHiloTicket } from "./vista-hilo-ticket";

export const metadata = { title: "Ticket de soporte" };

export default async function TicketPage(props: PageProps<"/panel/soporte/[id]">) {
  const { id } = await props.params;
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/soporte");

  const res = await obtenerHiloTicket(id);
  if (!res.ok) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaHiloTicket ticketInicial={res.data.ticket} mensajesIniciales={res.data.mensajes} soySupersu={false} />
    </div>
  );
}
