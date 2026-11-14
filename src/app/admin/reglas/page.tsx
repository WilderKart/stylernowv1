import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { EmptyState } from "@/components/brutal";
import { obtenerReglas } from "./actions";
import { VistaReglas } from "./vista-reglas";

export const metadata = { title: "Reglas operativas" };

export default async function AdminReglasPage() {
  const res = await obtenerReglas();

  return (
    <main className="w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Reglas y políticas" titulo="Reglas" resaltado="operativas." />
      {res.ok ? (
        <VistaReglas datos={res.data} />
      ) : (
        <EmptyState big="Error" title="No pudimos cargar las reglas" hint={res.error} />
      )}
    </main>
  );
}
