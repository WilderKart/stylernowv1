import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";
import { obtenerInvitacionPendiente } from "@/lib/invitaciones/invitacion-pendiente";
import { FormularioRegistro } from "./formulario-registro";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("login.tab_registro"), robots: { index: false, follow: false } };
}

/**
 * CREAR CUENTA (rediseño 2026-11-15): pantalla propia, distinta de /login.
 * Con ?tipo=negocio o ?next=/panel/onboarding llega con «Soy barbería o negocio» ya elegido.
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

  // Preselección del tipo (solo comodidad visual; el servidor vuelve a validar): «Para negocios»
  // enlaza con ?tipo=negocio o con next=/panel/onboarding.
  const tipoParam = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const tipoInicial =
    tipoParam === "negocio" || siguiente.startsWith("/panel/onboarding") ? "negocio" : tipoParam === "cliente" ? "cliente" : null;

  // Staff invitado: el correo sale de la invitación (servidor) y queda bloqueado.
  const invitacion = await obtenerInvitacionPendiente(Array.isArray(params.invitacion) ? params.invitacion[0] : params.invitacion);
  if (invitacion) {
    return <FormularioRegistro siguiente={`/invitacion/${invitacion.id}`} tipoInicial={null} invitacion={invitacion} />;
  }

  return <FormularioRegistro siguiente={siguiente} tipoInicial={tipoInicial} />;
}
