"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export interface HorarioDia {
  abierto: boolean;
  inicio: string;
  fin: string;
}
export type HorarioSemana = Record<
  "dom" | "lun" | "mar" | "mie" | "jue" | "vie" | "sab",
  HorarioDia
>;

function horarioAJson(horario: HorarioSemana) {
  return Object.fromEntries(
    Object.entries(horario)
      .filter(([, d]) => d.abierto)
      .map(([dia, d]) => [dia, [[d.inicio, d.fin]]])
  );
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso sobre esta sede.",
  PLAN_LIMIT_EXCEEDED:
    "Tu plan no permite más sedes. Hacé un upgrade para agregar otra (01-PRD/03_Monetization.md).",
  ULTIMA_SEDE_OPERATIVA: "No podés cerrar tu única sede operativa — el negocio quedaría sin dónde recibir reservas.",
  SEDE_CON_RESERVAS_ACTIVAS: "Esta sede tiene reservas activas o futuras. Reprogramalas o esperá a que se completen antes de cerrarla.",
  SEDE_NO_OPERATIVA: "Una sede cerrada no puede marcarse como principal — reabrila primero.",
  SEDE_NO_PERTENECE_AL_NEGOCIO: "Esa sede no pertenece a este negocio.",
  SEDE_DESTINO_NO_OPERATIVA: "No podés trasladar Staff a una sede cerrada.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

// ── Crear / actualizar sede ──────────────────────────────────────────────

export async function crearSede(datos: {
  negocioId: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  horario: HorarioSemana;
  latitud: number | null;
  longitud: number | null;
}): Promise<Resultado<{ id: string; esPrincipal: boolean }>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("crear_sede", {
      p_negocio_id: datos.negocioId,
      p_nombre: datos.nombre,
      p_direccion: datos.direccion,
      p_ciudad: datos.ciudad,
      p_horario_base: horarioAJson(datos.horario),
      p_latitud: datos.latitud ?? undefined,
      p_longitud: datos.longitud ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };

    revalidatePath("/panel/sedes");
    revalidatePath("/panel/onboarding");
    return { ok: true, data: { id: data.id, esPrincipal: data.es_principal } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarSede(datos: {
  sedeId: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  horario: HorarioSemana;
  latitud: number | null;
  longitud: number | null;
}): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    // Update directo bajo RLS (sede_update_barberia_guardian): a diferencia de
    // `negocio`, la política de SELECT de `sede` depende de la tabla `negocio`
    // (ya committeada), no de sí misma — no aplica acá el problema de
    // INSERT...RETURNING que sí afecta a `negocio` (ver actions.ts de onboarding).
    const { error } = await supabase
      .from("sede")
      .update({
        nombre: datos.nombre,
        direccion: datos.direccion,
        ciudad: datos.ciudad,
        horario_base: horarioAJson(datos.horario),
        latitud: datos.latitud,
        longitud: datos.longitud,
      })
      .eq("id", datos.sedeId);
    if (error) return { ok: false, error: traducirError(error.message) };

    revalidatePath("/panel/sedes");
    revalidatePath(`/panel/sedes/${datos.sedeId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Estado operativo ─────────────────────────────────────────────────────

export async function cerrarSedeTemporal(sedeId: string, motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("cerrar_sede", {
      p_sede_id: sedeId,
      p_permanente: false,
      p_motivo: motivo,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/sedes");
    revalidatePath(`/panel/sedes/${sedeId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function eliminarSede(sedeId: string, motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("cerrar_sede", {
      p_sede_id: sedeId,
      p_permanente: true,
      p_motivo: motivo,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/sedes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function reabrirSede(sedeId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("reabrir_sede", { p_sede_id: sedeId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/sedes");
    revalidatePath(`/panel/sedes/${sedeId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function marcarSedePrincipal(sedeId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("establecer_sede_principal", { p_sede_id: sedeId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/sedes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Staff de la sede + traslado ──────────────────────────────────────────

export async function trasladarStaff(vinculoId: string, nuevaSedeId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("trasladar_staff", {
      p_vinculo_id: vinculoId,
      p_nueva_sede_id: nuevaSedeId,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/sedes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Excepciones de horario (festivos, cierres puntuales, horario especial) ─

export async function guardarExcepcion(datos: {
  sedeId: string;
  fecha: string;
  cerrado: boolean;
  horaInicio: string | null;
  horaFin: string | null;
  motivo: string;
}): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase
      .from("sede_horario_excepcion")
      .upsert(
        {
          sede_id: datos.sedeId,
          fecha: datos.fecha,
          cerrado: datos.cerrado,
          hora_inicio_especial: datos.cerrado ? null : datos.horaInicio,
          hora_fin_especial: datos.cerrado ? null : datos.horaFin,
          motivo: datos.motivo || null,
        },
        { onConflict: "sede_id,fecha" }
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/panel/sedes/${datos.sedeId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function eliminarExcepcion(id: string, sedeId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.from("sede_horario_excepcion").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/panel/sedes/${sedeId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
