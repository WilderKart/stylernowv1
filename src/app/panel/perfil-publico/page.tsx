import { almacenamientoDeImagenesDisponible } from "@/app/panel/onboarding/actions";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { VistaPerfilPublico } from "./vista-perfil-publico";

export const metadata = { title: "Perfil público" };

export default async function PerfilPublicoPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/perfil-publico");
  const supabase = await createClient();
  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, nombre, slug, descripcion, telefono_contacto, email_contacto, foto_principal_url, logo_url")
    .eq("id", contexto.negocioId!)
    .single();

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
        {negocio ? <VistaPerfilPublico negocio={negocio} hayImagenes={await almacenamientoDeImagenesDisponible()} /> : null}
      </main>
    </div>
  );
}
