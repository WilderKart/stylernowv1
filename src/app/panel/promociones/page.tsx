import { EmptyState } from "@/components/brutal";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { listarPromociones } from "./actions";
import { VistaPromociones } from "./vista-promociones";

export const metadata = { title: "Promociones" };

export default async function PromocionesPage() {
  // Las promociones son decisión comercial del dueño: guardian y profesionales no entran.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/promociones");
  const r = await listarPromociones();

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
        {r.ok ? (
          <VistaPromociones promociones={r.data.promociones} historial={r.data.historial} />
        ) : (
          <EmptyState big="Error" title="No pudimos cargar tus promociones" hint={r.error} />
        )}
      </main>
    </div>
  );
}
