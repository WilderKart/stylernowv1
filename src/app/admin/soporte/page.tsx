import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { listarTicketsAdmin } from "./actions";
import { ChatAdmin } from "./chat-admin";
import { listarChatsAdmin } from "./chat-actions";
import { ListaTickets } from "./lista-tickets";
import { PestanasSoporte } from "./pestanas-soporte";

export default async function AdminSoportePage(props: PageProps<"/admin/soporte">) {
  const [res, chats, params] = await Promise.all([listarTicketsAdmin(), listarChatsAdmin(), props.searchParams]);
  const c = typeof params.c === "string" ? params.c : null;
  const conversaciones = chats.ok ? chats.data : [];
  const tickets = res.ok ? res.data : [];

  return (
    <main className="w-full max-w-[1500px] min-w-0 flex-1 px-3 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Soporte" titulo="Centro de" resaltado="soporte." />
      <PestanasSoporte
        sinLeer={conversaciones.reduce((a, x) => a + x.noLeidosAdmin, 0)}
        ticketsAbiertos={tickets.filter((t) => t.estado !== "RESUELTO").length}
        chat={<ChatAdmin conversacionesIniciales={conversaciones} errorInicial={chats.ok ? null : chats.error} seleccionInicial={c} />}
        tickets={<ListaTickets ticketsIniciales={tickets} errorInicial={res.ok ? null : res.error} />}
      />
    </main>
  );
}
