import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { obtenerPendientesLegales } from "@/lib/auth/aceptacion-legal";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VistaAceptarLegal } from "./vista-aceptar-legal";

const TITULOS: Record<string, string> = {
  TERMINOS: "Términos y Condiciones",
  POLITICA_DATOS: "Política de Tratamiento de Datos",
};

export default async function AceptarLegalPage(props: PageProps<"/legal/aceptar">) {
  const params = await props.searchParams;
  const next = destinoSeguro(Array.isArray(params.next) ? params.next[0] : params.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const pendientes = await obtenerPendientesLegales(supabase, user.id);
  if (pendientes.length === 0) redirect(next);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-10">
        <h1 className="font-display mb-1.5 text-[22px] font-bold uppercase text-text">Actualizamos nuestros textos legales</h1>
        <p className="mb-6 text-[13px] text-text-muted">
          Hicimos un cambio importante en {pendientes.length > 1 ? "estos documentos" : "este documento"}. Necesitamos que lo aceptes antes de seguir usando StylerNow.
        </p>
        <VistaAceptarLegal
          next={next}
          textos={pendientes.map((p) => ({ ...p, titulo: TITULOS[p.tipo] ?? p.tipo }))}
        />
      </main>
    </div>
  );
}
