import { listarEventosFraude, obtenerMetricasLealtad } from "./actions";
import { VistaLealtadAdmin } from "./vista-lealtad-admin";

export default async function AdminLealtadPage() {
  const [metricas, eventos] = await Promise.all([obtenerMetricasLealtad(), listarEventosFraude()]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Lealtad</h1>
      <VistaLealtadAdmin
        metricas={metricas.ok ? metricas.data : null}
        errorMetricas={metricas.ok ? null : metricas.error}
        eventosIniciales={eventos.ok ? eventos.data : []}
      />
    </main>
  );
}
