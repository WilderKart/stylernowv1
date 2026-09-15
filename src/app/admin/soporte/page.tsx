import { listarTicketsAdmin } from "./actions";
import { ListaTickets } from "./lista-tickets";

export default async function AdminSoportePage() {
  const res = await listarTicketsAdmin();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Soporte</h1>
      <ListaTickets ticketsIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </main>
  );
}
