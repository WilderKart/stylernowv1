import { listarAuditoriaAdmin } from "./actions";
import { VistaAuditoriaAdmin } from "./vista-auditoria-admin";

export default async function AdminAuditoriaPage() {
  const res = await listarAuditoriaAdmin({});

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Auditoría</h1>
      <p className="mb-5 text-[12px] text-text-faint">Log completo e inmutable de la plataforma — últimos 200 eventos.</p>
      <VistaAuditoriaAdmin eventosIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </main>
  );
}
