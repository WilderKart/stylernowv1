import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InvitacionPendiente {
  id: string;
  email: string;
  negocio: string;
}

/**
 * Invitación de Staff PENDIENTE y vigente, leída en el servidor con la clave de servicio.
 * La usan el registro (correo bloqueado), el ingreso (correo precargado) y `registrarCuenta`
 * (que toma el correo de AQUÍ, nunca del formulario). Devuelve null si el id no es válido o la
 * invitación ya no está pendiente.
 */
export async function obtenerInvitacionPendiente(id: unknown): Promise<InvitacionPendiente | null> {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const admin = createAdminClient() as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: unknown }> };
  const [{ data: ruta }, { data: publica }] = await Promise.all([
    admin.rpc("invitacion_para_enrutar", { p_invitacion_id: id }),
    admin.rpc("invitacion_publica", { p_invitacion_id: id }),
  ]);
  const r = ruta as { email: string; estado: string } | null;
  const p = publica as { negocio: string | null } | null;
  if (!r || r.estado !== "PENDIENTE") return null;
  return { id, email: r.email, negocio: p?.negocio ?? "un negocio" };
}
