import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { listarEventosFraude, obtenerMetricasLealtad } from "./actions";
import { VistaLealtadAdmin } from "./vista-lealtad-admin";

export default async function AdminLealtadPage() {
  const [metricas, eventos] = await Promise.all([obtenerMetricasLealtad(), listarEventosFraude()]);

  return (
    <main className="w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Lealtad" titulo="Programa de" resaltado="lealtad." />
      <VistaLealtadAdmin
        metricas={metricas.ok ? metricas.data : null}
        errorMetricas={metricas.ok ? null : metricas.error}
        eventosIniciales={eventos.ok ? eventos.data : []}
      />
    </main>
  );
}
