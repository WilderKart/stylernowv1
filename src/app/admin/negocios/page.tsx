import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { listarNegocios } from "../actions";
import { ListaNegocios } from "./lista-negocios";

export default async function AdminNegociosPage() {
  const res = await listarNegocios();

  return (
    <main className="w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Negocios" titulo="Gestión de" resaltado="negocios." />
      <ListaNegocios negociosIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </main>
  );
}
