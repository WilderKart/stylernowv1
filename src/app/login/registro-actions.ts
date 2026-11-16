"use server";

import type { Pais } from "@/lib/cliente/preferencias";
import { telefonoE164, type PaisRegistro } from "@/lib/telefono-registro";
import { createClient } from "@/lib/supabase/server";
import { destinoInicial } from "@/lib/auth/destino-inicial";
import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { aceptarTextosLegales, faltaAceptarVigentes, idsTextosVigentes, obtenerPendientesLegales } from "@/lib/auth/aceptacion-legal";

const PAISES: Pais[] = ["CO", "US", "MX", "ES"];

/**
 * «Atrás» en «Completa tu perfil»: se cierra la sesión y vuelve al inicio del login. Solo actúa si el registro sigue
 * pendiente (nunca cierra la sesión de una cuenta ya creada). La cuenta de acceso sin registro la
 * elimina el cron pasado el plazo (migración 127, `cuentas_registro_abandonado`).
 */
export async function cancelarRegistro(): Promise<{ ok: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.registro_pendiente === true) {
    await supabase.auth.signOut();
  }
  return { ok: true };
}

/**
 * «COMPLETA TU PERFIL» (último paso de toda cuenta nueva, también la creada con Google).
 * `marketing` solo es true si el usuario marcó la casilla (opcional, sin premarcar).
 * El celular se valida aquí y otra vez en la base (migración 128), y se guarda como NO verificado.
 * Quien llegó por Google no marcó todavía Términos y Política de Datos: aquí es obligatorio y se
 * registra (versionado, con hora); quien se registró con contraseña ya los aceptó al registrarse.
 */
export async function crearCuentaRegistro(
  nombre: string,
  pais: string,
  telefono: string,
  marketing: boolean,
  aceptaTerminos = false,
  siguienteCrudo = "/",
): Promise<{ ok: true; pendientesLegales: boolean; destino: string } | { ok: false; error: string }> {
  const nombreLimpio = (nombre ?? "").trim().replace(/\s+/g, " ");
  if (nombreLimpio.length < 2 || nombreLimpio.length > 80) return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
  if (!PAISES.includes(pais as Pais)) return { ok: false, error: "País no disponible." };
  const e164 = telefonoE164(pais as PaisRegistro, String(telefono ?? "").slice(0, 30));
  if (!e164) return { ok: false, error: "Revisa tu número de celular: debe ser un celular válido del país elegido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión venció. Vuelve a ingresar." };
  if (await faltaAceptarVigentes(supabase, user.id)) {
    if (aceptaTerminos !== true) return { ok: false, error: "Debes aceptar los Términos y la Política de Tratamiento de Datos." };
    await aceptarTextosLegales(supabase, user.id, await idsTextosVigentes(supabase));
    await supabase.from("perfil").update({ consentimiento_datos_at: new Date().toISOString() }).eq("id", user.id).is("consentimiento_datos_at", null);
  }

  const { error } = await (supabase as unknown as {
    rpc: (n: string, a: object) => Promise<{ error: { message: string } | null }>;
  }).rpc("completar_registro_con_telefono", {
    p_nombre: nombreLimpio,
    p_pais: pais,
    p_telefono: e164,
    p_marketing: marketing === true,
    p_locale: "es",
  });
  if (error) {
    if (error.message.includes("TELEFONO_INVALIDO")) return { ok: false, error: "Revisa tu número de celular." };
    if (error.message.includes("NOMBRE_INVALIDO")) return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
    return { ok: false, error: "No pudimos guardar tu perfil. Intenta de nuevo." };
  }
  const pendientes = await obtenerPendientesLegales(supabase, user.id);
  // Destino resuelto en el servidor: negocio → onboarding (o panel si ya lo terminó); cliente → inicio.
  const destino = await destinoInicial(supabase, user, destinoSeguro(siguienteCrudo));
  return { ok: true, pendientesLegales: pendientes.length > 0, destino };
}

/** ¿El paso de perfil debe pedir la casilla legal? (cuenta nueva por Google que aún no la marcó). */
export async function requiereAceptacionEnPerfil(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return faltaAceptarVigentes(supabase, user.id);
}
