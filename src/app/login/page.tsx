import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { obtenerPreferencias } from "@/lib/cliente/preferencias";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";
import { FormularioLogin } from "./formulario";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("login.meta_titulo"), robots: { index: false, follow: false } };
}

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const siguiente = destinoSeguro(params.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Super Admin (creado desde la base de datos): nunca ve el registro de cliente.
    const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
    if (perfil?.es_supersu === true) redirect(siguiente !== "/" ? siguiente : "/admin");
    // C17: sesión activa pero registro sin completar (sin país) → se muestra el paso de registro.
    // Misma señal que el proxy (migración 127): sin esto, un pendiente con país podía entrar en bucle.
    const prefs = await obtenerPreferencias();
    if (user.app_metadata?.registro_pendiente === true || (prefs.ok && prefs.data.pais === null)) {
      return <FormularioLogin siguiente={siguiente} registroPendiente emailSesion={user.email ?? ""} />;
    }
    redirect(siguiente);
  }

  return <FormularioLogin siguiente={siguiente} />;
}
