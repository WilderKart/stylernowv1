import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { VistaInvitacion } from "./vista-invitacion";

export const metadata = { title: "Invitación a StylerNow", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * INVITACIÓN DE STAFF (2026-11-16). Pública: sin sesión muestra solo el negocio, el correo
 * ENMASCARADO y el estado (función `invitacion_publica`), con un único botón «Continuar con mi
 * invitación» que el servidor enruta a registro o a ingreso. Con sesión del correo invitado: aceptar
 * (con la autorización de tratamiento) o rechazar. Con otra sesión: aviso para cambiar de cuenta.
 */
export default async function InvitacionPage(props: PageProps<"/invitacion/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const rpc = supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown }> };

  const [{ data: publica }, { data: auth }] = await Promise.all([
    rpc.rpc("invitacion_publica", { p_invitacion_id: id }),
    supabase.auth.getUser(),
  ]);
  const info = publica as { negocio: string | null; email_enmascarado: string; estado: string } | null;
  if (!info) notFound();
  const negocio = info.negocio ?? "Un negocio";

  if (!auth.user) {
    return <VistaInvitacion modo="sin-sesion" invitacionId={id} negocio={negocio} emailEnmascarado={info.email_enmascarado} estado={info.estado} />;
  }

  // Con sesión: la base solo devuelve la invitación si es para el correo de esta cuenta.
  const { data: inv } = await supabase.from("invitacion_staff").select("id, email, sede_id").eq("id", id).maybeSingle();
  if (!inv || inv.email !== (auth.user.email ?? "").toLowerCase()) {
    return <VistaInvitacion modo="otra-cuenta" invitacionId={id} negocio={negocio} emailEnmascarado={info.email_enmascarado} estado={info.estado} />;
  }

  const [{ data: sede }, { data: texto }] = await Promise.all([
    inv.sede_id ? supabase.from("sede").select("nombre").eq("id", inv.sede_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("texto_legal")
      .select("contenido")
      .eq("tipo", "AUTORIZACION_STAFF_TRATAMIENTO")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <VistaInvitacion
      modo="responder"
      invitacionId={id}
      negocio={negocio}
      emailEnmascarado={info.email_enmascarado}
      estado={info.estado}
      sede={sede?.nombre ?? null}
      textoTratamiento={(texto?.contenido ?? "").replaceAll("{negocio}", negocio)}
    />
  );
}
