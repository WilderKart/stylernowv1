import { Pantalla } from "@/app/lealtad/ui-cliente";
import { obtenerPreferencias } from "@/lib/cliente/preferencias";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormIdiomaRegion } from "./form-idioma-region";

export const metadata = {
  title: "Idioma y región",
  robots: { index: false, follow: false },
};

export default async function IdiomaRegionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ajustes/idioma-region");

  const r = await obtenerPreferencias();
  const prefs = r.ok ? r.data : null;

  return (
    <Pantalla>
      <FormIdiomaRegion paisInicial={prefs?.pais ?? "CO"} localeInicial={prefs?.locale ?? "es"} enOnboarding={prefs ? !prefs.onboarding_completo : true} />
    </Pantalla>
  );
}
