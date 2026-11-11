import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type EventoIdentidad =
  | "GOOGLE_LOGIN"
  | "GOOGLE_LINK"
  | "GOOGLE_UNLINK"
  | "OAUTH_ERROR"
  | "CALLBACK_INVALIDO";

/**
 * ADR-015, Fase D — reutiliza `evento_auditoria` (no crea otro sistema).
 * Los eventos de identidad no tienen `negocio_id` (son a nivel de cuenta, no
 * de negocio) — visibles solo para el propio actor y SuperSU, vía las
 * policies `auditoria_select_actor`/`auditoria_select_supersu` ya
 * existentes. Se usa `createAdminClient()` porque `evento_auditoria` no
 * tiene policy de insert para roles de producto (mismo patrón que el resto
 * de la auditoría del proyecto).
 */
export async function registrarEventoIdentidad(
  evento: EventoIdentidad,
  actorId: string | null,
  detalle?: Record<string, Json>
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("evento_auditoria").insert({
    entidad_tipo: "identidad",
    entidad_id: actorId,
    accion: evento,
    actor_tipo: "CLIENTE", // Evento a nivel de cuenta — el rol de negocio no aplica acá.
    actor_id: actorId,
    payload_despues: detalle ?? undefined,
  });
}
