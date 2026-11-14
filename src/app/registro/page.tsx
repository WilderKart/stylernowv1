import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { obtenerPreferencias } from "@/lib/cliente/preferencias";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";
import { FormularioLogin } from "../login/formulario";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("login.tab_registro"), robots: { index: false, follow: false } };
}

/**
 * Crear cuenta (separado de /login por decisión del propietario, 2026-11-14). Mismo formulario y mismas
 * acciones de servidor; en este modo el código de acceso SÍ crea la cuenta y exige aceptar Términos y
 * Política de Datos. Con ?next=/panel/onboarding el texto habla del registro del negocio.
 * El profesional (staff) no se registra aquí: entra por invitación de su barbería (/invitacion/[id]).
 */
export default async function RegistroPage(props: PageProps<"/registro">) {
  const params = await props.searchParams;
  const siguiente = destinoSeguro(params.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const prefs = await obtenerPreferencias();
    if (user.app_metadata?.registro_pendiente === true || (prefs.ok && prefs.data.pais === null)) {
      return <FormularioLogin siguiente={siguiente} registroPendiente emailSesion={user.email ?? ""} modo="registro" />;
    }
    redirect(siguiente);
  }

  return <FormularioLogin siguiente={siguiente} modo="registro" />;
}
