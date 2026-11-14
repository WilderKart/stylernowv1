import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { requireSuperSU } from "@/lib/auth/require-supersu";
import { listarAuditoriaAdmin, listarEntidadesAdmin } from "./actions";
import { VistaAuditoriaAdmin } from "./vista-auditoria-admin";

export default async function AdminAuditoriaPage() {
  await requireSuperSU();
  const [res, entidades] = await Promise.all([listarAuditoriaAdmin({ pagina: 1 }), listarEntidadesAdmin()]);

  return (
    <main className="w-full max-w-3xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Auditoría" titulo="Registro de" resaltado="cambios." />
      <p className="-mt-3 mb-6 max-w-3xl text-[13px] text-text-muted">
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
