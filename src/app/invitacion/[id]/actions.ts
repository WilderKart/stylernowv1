"use server";

import { createClient } from "@/lib/supabase/server";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "Esta invitación no es para tu cuenta — iniciá sesión con el correo que la recibió.",
  INVITACION_NO_ENCONTRADA: "No encontramos esa invitación.",
  INVITACION_NO_PENDIENTE: "Esta invitación ya fue respondida.",
  INVITACION_EXPIRADA: "Esta invitación expiró — pedile a quien te invitó que te reenvíe una nueva.",
  YA_TIENE_VINCULO_ACTIVO: "Ya formás parte de otro negocio en StylerNow — un Staff solo puede tener un vínculo activo a la vez.",
  PLAN_LIMIT_EXCEEDED: "Ese negocio alcanzó el cupo de Staff de su plan justo ahora — probá de nuevo más tarde.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

export async function responderInvitacion(
  invitacionId: string,
  aceptar: boolean
): Promise<Resultado<{ aceptada: boolean }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "NO_AUTENTICADO" };

    const { data, error } = await supabase.rpc("responder_invitacion", {
      p_invitacion_id: invitacionId,
      p_aceptar: aceptar,
    });
    if (error) return { ok: false, error: traducirError(error.message) };

    return { ok: true, data: { aceptada: Boolean((data as { aceptada?: boolean } | null)?.aceptada) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
