import { listarNegocios } from "../actions";
import { ListaNegocios } from "./lista-negocios";

export default async function AdminNegociosPage() {
  const res = await listarNegocios();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Negocios</h1>
      <ListaNegocios negociosIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </main>
  );
}
