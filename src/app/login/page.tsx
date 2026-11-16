import { destinoInicial } from "@/lib/auth/destino-inicial";
import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { obtenerPreferencias } from "@/lib/cliente/preferencias";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";
import { CompletarPerfil } from "./completar-perfil";
import { FormularioIngreso } from "./formulario-ingreso";
import { requiereAceptacionEnPerfil } from "./registro-actions";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("login.meta_titulo"), robots: { index: false, follow: false } };
}

/**
 * INGRESAR. Sin sesión: correo + contraseña. Con sesión de una cuenta nueva sin perfil
 * (registro pendiente, migración 127): «Completa tu perfil». Con sesión completa: al destino.
 */
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
    // Misma señal que el proxy (migración 127): sin esto, un pendiente con país podía entrar en bucle.
    const prefs = await obtenerPreferencias();
    if (user.app_metadata?.registro_pendiente === true || (prefs.ok && prefs.data.pais === null)) {
      return <CompletarPerfil email={user.email ?? ""} siguiente={siguiente} pedirAceptacion={await requiereAceptacionEnPerfil()} />;
    }
    // Sesión completa: destino resuelto en el servidor (retoma el onboarding de negocio si quedó a medias).
    redirect(await destinoInicial(supabase, user, siguiente));
  }

  const aviso = params.recuperada === "1" ? "recuperada" : params.error ? "enlace" : undefined;
  return <FormularioIngreso siguiente={siguiente} aviso={aviso} />;
}
