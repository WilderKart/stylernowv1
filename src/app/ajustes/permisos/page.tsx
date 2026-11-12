import { Pantalla } from "@/app/lealtad/ui-cliente";
import { obtenerPreferencias } from "@/lib/cliente/preferencias";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormPermisos } from "./form-permisos";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("perm.meta"), robots: { index: false, follow: false } };
}

export default async function PermisosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ajustes/permisos");

  const r = await obtenerPreferencias();
  const prefs = r.ok ? r.data : null;

  return (
    <Pantalla>
      <FormPermisos
        ubicacionInicial={prefs?.permiso_ubicacion ?? null}
        notificacionesInicial={prefs?.permiso_notificaciones ?? null}
        enOnboarding={prefs ? !prefs.onboarding_completo : true}
      />
    </Pantalla>
  );
}
