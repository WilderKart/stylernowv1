import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { notFound, redirect } from "next/navigation";
import { obtenerHiloTicket } from "../actions";
import { VistaHiloTicket } from "./vista-hilo-ticket";

export const metadata = { title: "Ticket de soporte" };

export default async function TicketPage(props: PageProps<"/panel/soporte/[id]">) {
  const { id } = await props.params;
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/soporte");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const res = await obtenerHiloTicket(id);
  if (!res.ok) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaHiloTicket ticketInicial={res.data.ticket} mensajesIniciales={res.data.mensajes} soySupersu={false} />
    </div>
  );
}
