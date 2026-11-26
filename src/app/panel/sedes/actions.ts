"use server";

import { crearPreferenciaDePago } from "@/lib/pagos/cobro";
import { MENSAJE_RESTRINGIDA } from "@/lib/suscripcion/estado-operativo";
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
  SUSCRIPCION_RESTRINGIDA: MENSAJE_RESTRINGIDA,
  NO_AUTORIZADO: "No tienes permiso sobre esta sede.",
  PLAN_LIMIT_EXCEEDED:
    "Tu plan no permite más sedes. Haz un upgrade para agregar otra (01-PRD/03_Monetization.md).",
  ULTIMA_SEDE_OPERATIVA: "No puedes cerrar tu única sede operativa — el negocio quedaría sin dónde recibir reservas.",
  SEDE_CON_RESERVAS_ACTIVAS: "Esta sede tiene reservas activas o futuras. Reprogramalas o espera a que se completen antes de cerrarla.",
  SEDE_NO_OPERATIVA: "Una sede cerrada no puede marcarse como principal — reabrila primero.",
  SEDE_NO_PERTENECE_AL_NEGOCIO: "Esa sede no pertenece a este negocio.",
  SEDE_DESTINO_NO_OPERATIVA: "No puedes trasladar Staff a una sede cerrada.",
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
    // (ya committeada), no de sí misma — no aplica aquí el problema de
    // INSERT...RETURNING que sí afecta a `negocio` (ver actions.ts de onboarding).
    const { data: filas, error } = await supabase
      .from("sede")
      .update({
        nombre: datos.nombre,
        direccion: datos.direccion,
        ciudad: datos.ciudad,
        horario_base: horarioAJson(datos.horario),
        latitud: datos.latitud,
        longitud: datos.longitud,
      })
      .eq("id", datos.sedeId)
      .select("id");
    if (error) return { ok: false, error: traducirError(error.message) };
    // Sin filas actualizadas = la sede no es de esta persona (RLS): no se informa éxito.
    if (!filas || filas.length === 0) return { ok: false, error: "No tienes permiso sobre esta sede." };

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

export interface OfertaSedeExtra {
  /** Precio mensual de UNA sede extra en este plan (null = el plan no admite sedes extra: toca subir de plan). */
  precio: number | null;
  extrasVigentes: number;
  tope: number;
  vigenteHasta: string | null;
}

const TOPE_SEDES_EXTRA: Record<string, number> = { ESSENTIAL: 1, STUDIO: 2, PRESTIGE: 5 };

/** Lo que el propietario ve al llegar al límite de sedes de su plan (lectura por RLS; el cobro lo fija la base). */
export async function obtenerOfertaSedeExtra(negocioId: string): Promise<OfertaSedeExtra> {
  const supabase = await createClient();
  const [{ data: negocio }, { data: addon }] = await Promise.all([
    supabase.from("negocio").select("plan_codigo").eq("id", negocioId).maybeSingle(),
    supabase.from("negocio_addon").select("cantidad, activo, hasta").eq("negocio_id", negocioId).eq("addon_codigo", "SEDE_EXTRA").maybeSingle(),
  ]);
  const plan = negocio?.plan_codigo ?? "";
  const { data: p } = await supabase.from("plan").select("sede_addon_precio").eq("codigo", plan as "ESSENTIAL").maybeSingle();
  const vigente = addon?.activo && (!addon.hasta || new Date(addon.hasta).getTime() > Date.now());
  return {
    precio: p?.sede_addon_precio != null ? Number(p.sede_addon_precio) : null,
    extrasVigentes: vigente ? addon!.cantidad : 0,
    tope: TOPE_SEDES_EXTRA[plan] ?? 0,
    vigenteHasta: addon?.hasta ?? null,
  };
}

/**
 * Cobro de una sede adicional (AGREGAR) o de la renovación mensual de las que ya tiene (RENOVAR) por Mercado Pago, cuenta de
 * StylerNow. Precio, tope y negocio los decide la base; la sede extra solo se activa cuando el pago se aprueba.
 */
export async function iniciarPagoSedeExtra(negocioId: string, modo: "AGREGAR" | "RENOVAR"): Promise<{ ok: true; url: string; preferenciaId: string; pagoId: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Inicia sesión de nuevo." };
    const { data, error } = await (supabase as unknown as {
      rpc: (n: string, a: object) => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
    }).rpc("sede_extra_iniciar_pago", { p_negocio_id: negocioId, p_modo: modo });
    if (error) {
      const m = error.message;
      if (/could not find the function/i.test(m)) return { ok: false, error: "El pago de sedes adicionales se está activando. Intenta de nuevo en unos minutos." };
      if (m.includes("TOPE_SEDES_EXTRA")) return { ok: false, error: "Llegaste al máximo de sedes adicionales de tu plan. Sube de plan para tener más sedes." };
      if (m.includes("PLAN_SIN_SEDES_EXTRA")) return { ok: false, error: "Tu plan no admite sedes adicionales. Sube de plan." };
      if (m.includes("SIN_SEDES_EXTRA_QUE_RENOVAR")) return { ok: false, error: "No tienes sedes adicionales para renovar." };
      if (m.includes("NO_AUTORIZADO")) return { ok: false, error: "No tienes permiso sobre este negocio." };
      return { ok: false, error: "No se pudo iniciar el pago. Intenta de nuevo." };
    }
    if (!data) return { ok: false, error: "No se pudo iniciar el pago." };
    const sitio = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const preferencia = await crearPreferenciaDePago({
      pagoId: data.id,
      titulo: modo === "AGREGAR" ? "Sede adicional (1 mes) · StylerNow" : "Renovación de sedes adicionales (1 mes) · StylerNow",
      emailPagador: user.email,
      urlRetorno: `${sitio}/panel/sedes?desde=pago`,
    });
    return { ok: true, url: preferencia.url, preferenciaId: preferencia.id, pagoId: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
