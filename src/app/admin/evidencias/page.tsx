import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { requireSuperSU } from "@/lib/auth/require-supersu";
import { VistaEvidencias } from "./vista-evidencias";

export const metadata = { title: "Evidencias legales" };

/**
 * Centro de Evidencias Legales. No carga nada al abrir: cada búsqueda es una consulta explícita que
 * queda en la auditoría (no se registran consultas «de paso» por solo entrar a la pantalla).
 */
export default async function AdminEvidenciasPage() {
  await requireSuperSU();
  return (
    <main className="w-full max-w-4xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Evidencias legales" titulo="Centro de" resaltado="evidencias." />
      <p className="-mt-3 mb-6 max-w-3xl text-[13px] text-text-muted">
        Aceptaciones, autorizaciones, revocaciones y solicitudes de los titulares, con el texto exacto y su huella. Repositorio
        de solo anexión: nada se edita ni se borra. Cada consulta y exportación queda registrada en Auditoría.
      </p>
      <VistaEvidencias />
    </main>
  );
}
