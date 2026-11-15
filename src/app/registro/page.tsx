import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";
import { FormularioRegistro } from "./formulario-registro";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("login.tab_registro"), robots: { index: false, follow: false } };
}

/**
 * CREAR CUENTA (rediseño 2026-11-15): pantalla propia, distinta de /login.
 * Con ?next=/panel/onboarding el texto habla del registro del negocio.
 * El profesional (staff) no se registra aquí: entra por invitación de su barbería (/invitacion/[id]).
 */
export default async function RegistroPage(props: PageProps<"/registro">) {
  const params = await props.searchParams;
  const siguiente = destinoSeguro(params.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Con sesión no se crea otra cuenta: /login decide (perfil pendiente, Super Admin o destino).
  if (user) redirect(`/login${siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : ""}`);

  return <FormularioRegistro siguiente={siguiente} />;
}
