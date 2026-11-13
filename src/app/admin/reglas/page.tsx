import { EmptyState, Poster } from "@/components/brutal";
import { obtenerReglas } from "./actions";
import { VistaReglas } from "./vista-reglas";

export const metadata = { title: "Reglas operativas" };

export default async function AdminReglasPage() {
  const res = await obtenerReglas();

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-5 py-8 sm:px-10">
      <Poster as="h1" size={3} className="mb-6 break-words">
        Reglas operativas
      </Poster>
      {res.ok ? (
        <VistaReglas datos={res.data} />
      ) : (
        <EmptyState big="Error" title="No pudimos cargar las reglas" hint={res.error} />
      )}
    </main>
  );
}
