import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { obtenerPreferencias } from "@/lib/cliente/preferencias";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioLogin } from "./formulario";

export const metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const siguiente = destinoSeguro(params.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // C17: sesión activa pero registro sin completar (sin país) → se muestra el paso de registro.
    const prefs = await obtenerPreferencias();
    if (prefs.ok && prefs.data.pais === null) {
      return <FormularioLogin siguiente={siguiente} registroPendiente emailSesion={user.email ?? ""} />;
    }
    redirect(siguiente);
  }

  return <FormularioLogin siguiente={siguiente} />;
}
