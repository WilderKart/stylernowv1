import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { listarPagosPorRevisar, obtenerMediosPago } from "./actions";
import { VistaPagos } from "./vista-pagos";

export const metadata = { title: "Pagos directos" };

export default async function PagosPage() {
  // Verificar pagos y configurar cuentas es decisión exclusiva del dueño.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/pagos");
  const [medios, pagos] = await Promise.all([obtenerMediosPago(), listarPagosPorRevisar()]);
  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
        <VistaPagos
          medios={medios.ok ? medios.data : null}
          errorMedios={medios.ok ? null : medios.error}
          pagos={pagos.ok ? pagos.data : []}
          errorPagos={pagos.ok ? null : pagos.error}
        />
      </main>
    </div>
  );
}
