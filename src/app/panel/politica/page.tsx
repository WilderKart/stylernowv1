import { EmptyState } from "@/components/brutal";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { obtenerAnticipo, obtenerPolitica, obtenerVentana } from "./actions";
import { VistaAnticipo } from "./vista-anticipo";
import { VistaPolitica } from "./vista-politica";
import { VistaVentana } from "./vista-ventana";

export const metadata = { title: "Anticipo, cancelaciones y ventana de reservas" };

export default async function PoliticaPage() {
  // La política define cuánto dinero se devuelve: decisión del dueño, como el plan.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/politica");
  const [r, a, v] = await Promise.all([obtenerPolitica(), obtenerAnticipo(), obtenerVentana()]);

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8">
        {a.ok ? (
          <div className="mb-10">
            <VistaAnticipo anticipo={a.data.anticipo} />
          </div>
        ) : null}
        {v.ok ? (
          <div className="mb-10">
            <VistaVentana ventana={v.data.ventana} />
          </div>
        ) : null}
        {r.ok ? (
          <VistaPolitica politica={r.data.politica} limites={r.data.limites} />
        ) : (
          <EmptyState big="Error" title="No pudimos cargar tu política" hint={r.error} />
        )}
      </main>
    </div>
  );
}
