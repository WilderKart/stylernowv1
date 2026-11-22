"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ipDelLlamador, limitar } from "@/lib/rate-limit";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "Esta invitación no es para tu cuenta: ingresa con el correo que la recibió.",
  CORREO_NO_VERIFICADO: "Primero verifica tu correo con el código que te enviamos.",
  INVITACION_NO_ENCONTRADA: "No encontramos esa invitación.",
  INVITACION_NO_PENDIENTE: "Esta invitación ya fue respondida.",
  INVITACION_EXPIRADA: "Esta invitación expiró: pídele a quien te invitó que te envíe una nueva.",
  YA_TIENE_VINCULO_ACTIVO: "Ya formas parte de otro negocio en StylerNow: un profesional solo puede tener un vínculo activo a la vez.",
  PLAN_LIMIT_EXCEEDED: "Ese negocio alcanzó el cupo de profesionales de su plan. Avísale a quien te invitó.",
  AUTORIZACION_TRATAMIENTO_REQUERIDA: "Para unirte al equipo debes autorizar el tratamiento de tus datos para tu vínculo profesional.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : "No pudimos completar la acción. Intenta de nuevo.";
}

/**
 * «CONTINUAR CON MI INVITACIÓN» (sin sesión). El servidor, con la clave de servicio, mira si el
 * correo invitado ya tiene cuenta y devuelve a dónde ir: registro (correo bloqueado) o ingreso
 * (correo precargado). Solo quien tiene el enlace del correo puede llamarla con un id válido, y el
 * resultado es una ruta, no un «existe / no existe»; además, límite por IP contra barridos.
 */
export async function continuarInvitacion(invitacionId: string): Promise<Resultado<{ destino: string }>> {
  if (!UUID.test(invitacionId)) return { ok: false, error: MENSAJES_ERROR.INVITACION_NO_ENCONTRADA };
  const limite = await limitar("invitacion-ip", await ipDelLlamador(), 20, 600);
  if (!limite.ok) return { ok: false, error: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." };

  const admin = createAdminClient() as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> };
  const { data, error } = await admin.rpc("invitacion_para_enrutar", { p_invitacion_id: invitacionId });
  const inv = data as { estado: string; tiene_cuenta: boolean } | null;
  if (error || !inv) return { ok: false, error: MENSAJES_ERROR.INVITACION_NO_ENCONTRADA };
  if (inv.estado === "EXPIRADA") return { ok: false, error: MENSAJES_ERROR.INVITACION_EXPIRADA };
  if (inv.estado !== "PENDIENTE") return { ok: false, error: MENSAJES_ERROR.INVITACION_NO_PENDIENTE };

  const vuelta = encodeURIComponent(`/invitacion/${invitacionId}`);
  return {
    ok: true,
    data: { destino: inv.tiene_cuenta ? `/login?invitacion=${invitacionId}&next=${vuelta}` : `/registro?invitacion=${invitacionId}` },
  };
}

/** Aceptar (con autorización de tratamiento) o rechazar. Todo lo valida la base en una transacción. */
export async function responderInvitacion(
  invitacionId: string,
  aceptar: boolean,
  autorizaTratamiento = false
): Promise<Resultado<{ aceptada: boolean }>> {
  try {
    if (!UUID.test(invitacionId)) return { ok: false, error: MENSAJES_ERROR.INVITACION_NO_ENCONTRADA };
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Tu sesión venció. Vuelve a ingresar." };

    const rpc = supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { data, error } = aceptar
      ? await rpc.rpc("aceptar_invitacion_staff", { p_invitacion_id: invitacionId, p_autoriza_tratamiento: autorizaTratamiento === true })
      : await rpc.rpc("responder_invitacion", { p_invitacion_id: invitacionId, p_aceptar: false });
    if (error) return { ok: false, error: traducirError(error.message) };

    return { ok: true, data: { aceptada: Boolean((data as { aceptada?: boolean } | null)?.aceptada) } };
  } catch {
    return { ok: false, error: "No pudimos completar la acción. Intenta de nuevo." };
  }
}

/** Cerrar sesión para entrar con el correo correcto (sesión con otro correo distinto al invitado). */
export async function salirParaCambiarCuenta(): Promise<{ ok: true }> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true };
}
