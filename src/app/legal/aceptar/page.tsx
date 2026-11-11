import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { obtenerPendientesLegales } from "@/lib/auth/aceptacion-legal";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Hot, PantallaAuth } from "@/app/login/_componentes/pantalla-auth";
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
    <PantallaAuth
      indice="Legal / Actualización"
      volver="/"
      tamano={3}
      ancho="max-w-2xl"
      titulo={
        <>
          Textos legales
          <br />
          <Hot>actualizados.</Hot>
        </>
      }
      intro={`Hicimos un cambio importante en ${pendientes.length > 1 ? "estos documentos" : "este documento"}. Necesitamos que lo aceptes antes de seguir usando StylerNow.`}
    >
      <VistaAceptarLegal
        next={next}
        textos={pendientes.map((p) => ({ ...p, titulo: TITULOS[p.tipo] ?? p.tipo }))}
      />
    </PantallaAuth>
  );
}
