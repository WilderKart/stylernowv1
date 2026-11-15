import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { obtenerT } from "@/lib/i18n/servidor";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VistaVerificar } from "./vista-verificar";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: `${t("auth.ver_t1")} ${t("auth.ver_t2")}`, robots: { index: false, follow: false } };
}

/** Verificación del correo tras crear la cuenta (pantalla propia; ver vista-verificar.tsx). */
export default async function VerificarPage(props: PageProps<"/registro/verificar">) {
  const params = await props.searchParams;
  const siguiente = destinoSeguro(params.next);

  // Con sesión ya no hay nada que verificar: /login decide (perfil pendiente o destino final).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`/login${siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : ""}`);

  return <VistaVerificar siguiente={siguiente} />;
}
