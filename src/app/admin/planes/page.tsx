import { EmptyState, Poster } from "@/components/brutal";
import { obtenerDatosPlanes } from "./actions";
import { EditorPlanes } from "./editor-planes";

export const metadata = { title: "Planes y precios" };

export default async function AdminPlanesPage() {
  const res = await obtenerDatosPlanes();

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-5 py-8 sm:px-10">
      <Poster as="h1" size={3} className="mb-6 break-words">
        Planes y precios
      </Poster>
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
