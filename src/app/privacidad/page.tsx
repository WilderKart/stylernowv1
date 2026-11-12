import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { historialPrivacidad, obtenerPrivacidad } from "@/lib/cliente/privacidad";
import { VistaPrivacidad } from "./vista-privacidad";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("priv.meta"), robots: { index: false, follow: false } };
}

export default async function PrivacidadPage() {
  // Guard de sesión en el servidor (defensa en profundidad además del proxy).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/privacidad");

  const [estado, historial] = await Promise.all([obtenerPrivacidad(), historialPrivacidad()]);
  return (
    <VistaPrivacidad
      estado={estado.ok ? estado.data : []}
      historial={historial.ok ? historial.data : []}
      error={!estado.ok ? estado.error : !historial.ok ? historial.error : null}
    />
  );
}
