import { notFound } from "next/navigation";
import { obtenerHiloTicketAdmin } from "../actions";
import { VistaHiloTicketAdmin } from "./vista-hilo-ticket-admin";

export default async function AdminTicketPage(props: PageProps<"/admin/soporte/[id]">) {
  const { id } = await props.params;
  const res = await obtenerHiloTicketAdmin(id);
  if (!res.ok) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-10">
      <VistaHiloTicketAdmin ticketInicial={res.data.ticket} mensajesIniciales={res.data.mensajes} />
    </main>
  );
}
