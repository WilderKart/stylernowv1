import { BarraSuperior } from "@/components/layout/header";
import { AvisoPlan } from "@/components/planes/aviso-plan";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { Suspense } from "react";
import { obtenerPanelAdicionales } from "./actions";
import { VistaAdicionales } from "./vista-adicionales";

export const metadata = { title: "Barberos adicionales" };

/**
 * Contratar y administrar barberos adicionales: SOLO el propietario (BARBERIA). El administrador delegado y el guardián no entran:
 * lo comercial es del propietario. La base vuelve a exigirlo en cada RPC (is_barberia_de).
 */
export default async function AdicionalesPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/staff/adicionales");
  const negocioId = contexto.negocioId!;
  const res = await obtenerPanelAdicionales(negocioId);

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <BarraSuperior titulo="Barberos adicionales" volverA="/panel/staff" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-10">
        {res.ok ? (
          <Suspense fallback={null}>
            <VistaAdicionales negocioId={negocioId} inicial={res.data} />
          </Suspense>
        ) : (
          <AvisoPlan titulo="No pudimos cargar tus barberos adicionales" detalle={res.error} accion="VOLVER A EQUIPO" href="/panel/staff" />
        )}
      </main>
    </div>
  );
}
