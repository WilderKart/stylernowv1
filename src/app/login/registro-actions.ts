"use server";

import { obtenerPreferencias, type Pais } from "@/lib/cliente/preferencias";
import { telefonoE164, type PaisRegistro } from "@/lib/telefono-registro";
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
  if (user.app_metadata?.registro_pendiente === true) return { necesita: true, email: user.email ?? "" };
  // El Super Admin se crea desde la base de datos: nunca ve el registro de cliente.
  const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
  if (perfil?.es_supersu === true) return { necesita: false, email: user.email ?? "" };
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

/**
 * «CREAR CUENTA». `marketing` solo es true si el usuario marcó la casilla (opcional, sin premarcar).
 * El celular se valida aquí y otra vez en la base (migración 128), y se guarda como NO verificado.
 */
export async function crearCuentaRegistro(
  nombre: string,
  pais: string,
  telefono: string,
  marketing: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nombreLimpio = (nombre ?? "").trim().replace(/\s+/g, " ");
  if (nombreLimpio.length < 2 || nombreLimpio.length > 80) return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
  if (!PAISES.includes(pais as Pais)) return { ok: false, error: "País no disponible." };
  const e164 = telefonoE164(pais as PaisRegistro, String(telefono ?? "").slice(0, 30));
  if (!e164) return { ok: false, error: "Revisa tu número de celular: debe ser un celular válido del país elegido." };

  const supabase = await createClient();
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
    return { ok: false, error: "No pudimos crear tu cuenta. Intenta de nuevo." };
  }
  return { ok: true };
}
