import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { listarSolicitudesPendientes } from "./actions";
import { VistaSolicitudes } from "./vista-solicitudes";

export const metadata = { title: "Solicitudes del equipo" };

export default async function SolicitudesPage() {
  // Decide la barbería (propietario) o el Guardian de la sede; la base lo vuelve a exigir en cada decisión.
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/staff/solicitudes");
  const datos = await listarSolicitudesPendientes(contexto.negocioId);

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} prestaServicios={contexto.prestaServicios} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
        <VistaSolicitudes {...datos} />
      </main>
    </div>
  );
}
