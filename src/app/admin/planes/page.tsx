import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { EmptyState } from "@/components/brutal";
import { obtenerDatosPlanes } from "./actions";
import { EditorPlanes } from "./editor-planes";

export const metadata = { title: "Planes y precios" };

export default async function AdminPlanesPage() {
  const res = await obtenerDatosPlanes();

  return (
    <main className="w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Planes y suscripciones" titulo="Planes y" resaltado="precios." />
      {!res.ok ? (
        <EmptyState big="Error" title="No pudimos cargar los datos" hint={res.error} />
      ) : res.data.paises.length === 0 ? (
        <EmptyState big="Vacío" title="No hay países configurados" hint="Revisa las migraciones de planes y países." />
      ) : (
        <EditorPlanes datos={res.data} />
      )}
    </main>
  );
}
