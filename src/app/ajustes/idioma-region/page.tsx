import { Pantalla } from "@/app/lealtad/ui-cliente";
import { obtenerPreferencias } from "@/lib/cliente/preferencias";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormIdiomaRegion } from "./form-idioma-region";
import { obtenerT } from "@/lib/i18n/servidor";
import { SelectorTema } from "@/components/tema/tema-cliente";
import { ServicioPreferido } from "./servicio-preferido";
import { obtenerModoTema } from "@/lib/tema/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("aj.meta_idioma"), robots: { index: false, follow: false } };
}

export default async function IdiomaRegionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ajustes/idioma-region");

  const r = await obtenerPreferencias();
  const prefs = r.ok ? r.data : null;
  const modoTema = await obtenerModoTema();
  const { data: perfilInteres } = await supabase.from("perfil").select("categorias_interes").eq("id", user.id).maybeSingle();

  return (
    <Pantalla>
      <FormIdiomaRegion paisInicial={prefs?.pais ?? "CO"} localeInicial={prefs?.locale ?? "es"} enOnboarding={prefs ? !prefs.onboarding_completo : true} />
      <div className="mt-8 flex flex-col gap-8 px-4">
        <ServicioPreferido inicial={perfilInteres?.categorias_interes?.[0] ?? null} />
        <SelectorTema modoInicial={modoTema} />
      </div>
    </Pantalla>
  );
}
