import { PanelNav } from "@/components/panel/panel-nav";
import { almacenamientoDeImagenesDisponible } from "@/app/panel/onboarding/actions";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import type { EstadoVerificacion } from "@/lib/verificacion/tipos";
import { VistaVerificacion, type MiVerificacion } from "./vista-verificacion";

export const metadata = { title: "Verificación" };

export default async function VerificacionPage() {
  // Solo el propietario: Guardian y Staff no gestionan documentos del negocio.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/verificacion");
  const negocioId = contexto.negocioId!;
  const supabase = await createClient();

  const { data } = await (supabase as unknown as {
    rpc: (n: string, a: object) => Promise<{ data: MiVerificacion | null }>;
  }).rpc("mi_verificacion_negocio", { p_negocio_id: negocioId });
  // El negocio se aprueba en /admin/negocios (estado del negocio); la insignia de verificación es otro proceso
  // (documentos). Se muestran por separado para que "negocio aprobado" nunca parezca "en revisión".
  const { data: negocio } = await supabase.from("negocio").select("estado").eq("id", negocioId).maybeSingle();
  const inicial: MiVerificacion = data ?? {
    estado: "NO_INICIADA" as EstadoVerificacion,
    motivo: null,
    enviada_at: null,
    decidida_at: null,
    documentos: [],
  };

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
        <VistaVerificacion negocioId={negocioId} inicial={inicial} estadoNegocio={negocio?.estado ?? null} almacenamiento={await almacenamientoDeImagenesDisponible()} />
      </main>
    </div>
  );
}
