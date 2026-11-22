import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { EmptyState } from "@/components/brutal";
import { obtenerAdicionalesAdmin } from "./actions";
import { VistaAdicionalesAdmin } from "./vista-adicionales-admin";

export const metadata = { title: "Barberos adicionales" };

type Params = { estado?: string; negocio?: string; texto?: string; vence?: string };

export default async function AdminAdicionalesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await searchParams;
  const res = await obtenerAdicionalesAdmin({ estado: q.estado, negocioId: q.negocio, texto: q.texto, venceAntes: q.vence });

  return (
    <main className="w-full max-w-6xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Ingresos y producto"
        titulo="Barberos"
        resaltado="adicionales."
        descripcion="Precio por plan, límites, lotes contratados, excepciones con motivo y cola de reembolsos. Todo queda en la auditoría."
      />
      {res.ok ? (
        <VistaAdicionalesAdmin datos={res.data} filtros={q} />
      ) : (
        <EmptyState big="Error" title="No pudimos cargar los barberos adicionales" hint={res.error} />
      )}
    </main>
  );
}
