import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { listarTicketsAdmin } from "./actions";
import { ChatAdmin } from "./chat-admin";
import { listarChatsAdmin } from "./chat-actions";
import { ListaTickets } from "./lista-tickets";

export default async function AdminSoportePage() {
  const [res, chats] = await Promise.all([listarTicketsAdmin(), listarChatsAdmin()]);

  return (
    <main className="w-full max-w-3xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Soporte" titulo="Centro de" resaltado="soporte." />
      <ChatAdmin conversacionesIniciales={chats.ok ? chats.data : []} errorInicial={chats.ok ? null : chats.error} />
      <ListaTickets ticketsIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </main>
  );
}
