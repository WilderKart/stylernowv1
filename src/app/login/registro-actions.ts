"use server";

import { obtenerPreferencias, completarRegistro, type Pais } from "@/lib/cliente/preferencias";
import { createClient } from "@/lib/supabase/server";

const PAISES: Pais[] = ["CO", "US", "MX", "ES"];

/**
 * ¿Debe ver el paso de registro (C17)? Solo con sesión activa y mientras el perfil no tenga
 * país guardado (completar_registro es lo que lo fija). La identidad sale de la sesión.
 */
export async function necesitaRegistro(): Promise<{ necesita: boolean; email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { necesita: false, email: "" };
  const r = await obtenerPreferencias();
  return { necesita: r.ok ? r.data.pais === null : false, email: user.email ?? "" };
}

/**
 * «Atrás» en el paso de registro: el usuario no creó la cuenta, así que se cierra la sesión que
 * abrió la verificación del código y vuelve al inicio del login. Solo actúa si el registro sigue
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

/** «CREAR CUENTA». `marketing` solo es true si el usuario marcó la casilla (opcional, sin premarcar). */
export async function crearCuentaRegistro(
  nombre: string,
  pais: string,
  marketing: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nombreLimpio = (nombre ?? "").trim().replace(/\s+/g, " ");
  if (nombreLimpio.length < 2 || nombreLimpio.length > 80) return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
  if (!PAISES.includes(pais as Pais)) return { ok: false, error: "País no disponible." };
  const r = await completarRegistro({ nombre: nombreLimpio, pais: pais as Pais, marketing: marketing === true, locale: "es" });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}
