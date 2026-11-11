import { EmptyState } from "@/components/brutal";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { obtenerCatalogoPais } from "@/lib/planes/catalogo";
import { obtenerCatalogoPlanes, obtenerMiSuscripcion } from "./actions";
import { obtenerUsoNegocio } from "./datos";
import { VistaSuscripcion } from "./vista-suscripcion";

export const metadata = { title: "Plan y facturación" };

export default async function SuscripcionPage() {
  // 04_Subscriptions_Lifecycle.md: solo la Barbería (dueña de la
  // suscripción) gestiona upgrade/downgrade/cancelación — Guardian/Staff no.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/suscripcion");
  const negocioId = contexto.negocioId!;

  const [suscripcionRes, planesRes, uso] = await Promise.all([
    obtenerMiSuscripcion(negocioId),
    obtenerCatalogoPlanes(),
    obtenerUsoNegocio(negocioId),
  ]);

  if (!suscripcionRes.ok) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg">
        <PanelNav rol={contexto.rol} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8">
          <EmptyState
            big="Error"
            title="No pudimos cargar tu plan"
            hint={suscripcionRes.error}
          />
        </main>
      </div>
    );
  }

  // El país sale de la suscripción/negocio en BD, nunca del navegador.
  const catalogo = await obtenerCatalogoPais(suscripcionRes.data.paisCodigo || uso.paisNegocio || "CO");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaSuscripcion
        negocioId={negocioId}
        suscripcionInicial={suscripcionRes.data}
        planes={planesRes.ok ? planesRes.data : []}
        catalogo={catalogo}
        uso={{ sedes: uso.sedes, staff: uso.staff }}
        fundador={uso.fundador}
      />
    </div>
  );
}
