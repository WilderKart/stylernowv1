"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Entrada = z.object({
  vinculoId: z.string().uuid(),
  sedeId: z.string().uuid(),
  dias: z.array(z.object({ dia: z.number().int().min(0).max(6), inicio: Hora, fin: Hora })).max(7),
});

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "Solo la propietaria del negocio puede definir el horario de una persona del equipo.",
  NO_PRESTA_SERVICIOS: "Esa persona no atiende clientes, no necesita horario.",
  SEDE_INVALIDA: "La sede no es válida para esa persona.",
  HORARIO_INVALIDO: "Revisa las horas: en cada día la hora de fin debe ser posterior a la de inicio.",
  SUSCRIPCION_RESTRINGIDA: "La suscripción del negocio está restringida; no se puede cambiar horarios por ahora.",
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
};

/**
 * La propietaria define el horario semanal de una persona de su equipo (cuando esa persona no lo configuró). La decisión y la autorización
 * las toma la base (`propietario_definir_horario_staff`, migración 206): aquí solo se valida la forma de los datos.
 */
export async function guardarHorarioDelStaff(entrada: z.input<typeof Entrada>): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = Entrada.safeParse(entrada);
  if (!p.success) return { ok: false, error: "Datos inválidos." };
  const { vinculoId, sedeId, dias } = p.data;
  if (new Set(dias.map((d) => d.dia)).size !== dias.length) return { ok: false, error: "Hay un día repetido." };
  if (dias.some((d) => d.fin <= d.inicio)) return { ok: false, error: MENSAJES.HORARIO_INVALIDO };

  const supabase = await createClient();
  const { error } = await (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ error: { message: string } | null }> }).rpc(
    "propietario_definir_horario_staff",
    { p_vinculo_id: vinculoId, p_sede_id: sedeId, p_dias: dias.map((d) => ({ dia_semana: d.dia, hora_inicio: d.inicio, hora_fin: d.fin })) }
  );
  if (error) {
    const k = Object.keys(MENSAJES).find((c) => error.message.includes(c));
    return { ok: false, error: k ? MENSAJES[k] : "No pudimos guardar el horario. Intenta de nuevo." };
  }
  revalidatePath(`/panel/staff/${vinculoId}`);
  revalidatePath("/panel/staff");
  return { ok: true };
}
