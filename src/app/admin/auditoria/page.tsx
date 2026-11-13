import { requireSuperSU } from "@/lib/auth/require-supersu";
import { listarAuditoriaAdmin, listarEntidadesAdmin } from "./actions";
import { VistaAuditoriaAdmin } from "./vista-auditoria-admin";

export default async function AdminAuditoriaPage() {
  await requireSuperSU();
  const [res, entidades] = await Promise.all([listarAuditoriaAdmin({ pagina: 1 }), listarEntidadesAdmin()]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Auditoría</h1>
      <p className="mb-5 text-[12px] text-text-faint">
        Registro inmutable de la plataforma: quién cambió qué, valor anterior y nuevo, motivo y origen.
      </p>
      <VistaAuditoriaAdmin
        inicial={res.ok ? res.data : null}
        errorInicial={res.ok ? null : res.error}
        entidades={entidades.ok ? entidades.data : []}
      />
    </main>
  );
}
