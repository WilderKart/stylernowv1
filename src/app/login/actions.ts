"use server";

import { registrarAceptacionLegal } from "@/lib/auth/aceptacion-legal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarContrasenaNueva } from "@/lib/auth/password-validator";
import { guardarEnHistorial } from "@/lib/auth/password-history";
import { registrarIntentoAuth, verificarRateLimitAuth } from "@/lib/auth/rate-limit-auth";
import { googleProvider } from "@/lib/auth/providers/google-provider";
import { headers } from "next/headers";

/**
 * Dominio de la request actual, no un valor fijo de env: Vercel sirve este proyecto
 * bajo más de un alias (el corto y el largo con el hash del team), y el link del
 * correo tiene que volver exactamente por donde entró el usuario. Cualquier alias
 * que se use acá debe estar en Supabase → Authentication → URL Configuration →
 * Redirect URLs, si no Supabase rechaza el `emailRedirectTo`.
 */
async function origenActual() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function enviarCodigo(email: string, siguiente: string, aceptaTerminos: boolean) {
  // Zero-trust: el checkbox del formulario es solo la primera barrera. Sin esta
  // validación acá, cualquiera podía llamar a esta action directo (sin pasar por
  // la UI) y saltarse el consentimiento exigido por 06-Security/04_Compliance_
  // Colombia.md.
  if (!aceptaTerminos) {
    return {
      ok: false as const,
      error: "Debés aceptar los Términos y la Política de Tratamiento de Datos.",
    };
  }

  const limite = await verificarRateLimitAuth(email, "otp_envio");
  if (!limite.ok) return { ok: false as const, error: limite.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // El link "Iniciar sesión" del correo vuelve acá en vez de a la home directo,
      // para que el intercambio de código realmente cree la sesión (src/app/auth/callback).
      emailRedirectTo: `${await origenActual()}/auth/callback?next=${encodeURIComponent(siguiente)}`,
    },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function verificarCodigo(email: string, token: string) {
  const limite = await verificarRateLimitAuth(email, "otp_verificacion");
  if (!limite.ok) return { ok: false as const, error: limite.error };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  await registrarIntentoAuth(email, "otp_verificacion", !error);
  if (error) return { ok: false as const, error: error.message };

  let faltaTelefono = false;
  let faltaContrasena = false;
  let pendientesLegales: { id: string; tipo: string }[] = [];

  if (data.user) {
    const { pendientesMateriales } = await registrarAceptacionLegal(supabase, data.user.id);
    pendientesLegales = pendientesMateriales.map((t) => ({ id: t.id, tipo: t.tipo }));

    // 06-Security/04_Compliance_Colombia.md: registrar timestamp de aceptación del
    // consentimiento (el checkbox ya fue exigido en el paso anterior del formulario).
    await supabase
      .from("perfil")
      .update({ consentimiento_datos_at: new Date().toISOString() })
      .eq("id", data.user.id)
      .is("consentimiento_datos_at", null);

    // handle_new_user() (migración 007) crea el perfil con el prefijo del email como
    // nombre provisorio y sin teléfono. Se usa "sin teléfono" como señal de que es el
    // primer login, para pedirle una sola vez sus datos reales (02-UX/02_Onboarding.md).
    const { data: perfil } = await supabase
      .from("perfil")
      .select("telefono, password_establecida")
      .eq("id", data.user.id)
      .single();
    faltaTelefono = !perfil?.telefono;
    // Auth_State_Machine.md: "OTP Verificado" → "Contraseña creada" es
    // obligatorio antes de llegar a "Cuenta activa" — se pide una sola vez.
    faltaContrasena = !perfil?.password_establecida;
  }

  return { ok: true as const, faltaTelefono, faltaContrasena, pendientesLegales };
}

/**
 * Auth_State_Machine.md: "OTP Verificado" → "Contraseña creada". Requiere
 * una sesión ya activa (recién creada por `verificarCodigo` u OTP previo) —
 * nunca acepta un `userId` del cliente, siempre lee la sesión real del lado
 * del servidor.
 *
 * Hallazgo de auditoría de seguridad (2026-09-18): esta acción no
 * verificaba `password_establecida` del lado del servidor — la UI
 * (`CambiarContrasena`) decide cuál de las dos acciones llamar solo por
 * prop, pero esta es una Server Action invocable directo. Sin este check,
 * cualquier sesión ya autenticada (por ejemplo, una secuestrada vía el XSS
 * de JSON-LD ya encontrado en esta misma auditoría) podía sobrescribir en
 * silencio la contraseña de una cuenta que YA tenía una — sin conocer la
 * actual — convirtiendo un secuestro de sesión efímero en una toma de
 * cuenta persistente. `cambiarContrasena()` sí exige la contraseña actual;
 * esta acción debe rechazar si ya existe una, no solo confiar en la UI.
 */
export async function crearContrasena(password: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sesión inválida — volvé a iniciar sesión." };

  const { data: perfil } = await supabase.from("perfil").select("password_establecida").eq("id", user.id).single();
  if (perfil?.password_establecida) {
    return { ok: false as const, error: "Ya tenés una contraseña — usá 'Cambiar contraseña' e ingresá la actual." };
  }

  const validacion = await validarContrasenaNueva(user.id, password);
  if (!validacion.ok) return validacion;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false as const, error: error.message };

  await guardarEnHistorial(user.id, password);
  await supabase.from("perfil").update({ password_establecida: true }).eq("id", user.id);

  return { ok: true as const };
}

/**
 * Fase D — el rol NUNCA se decide acá ni en Google: `login()` solo devuelve
 * la URL de Google, el intercambio real pasa por `/auth/callback` (mismo
 * camino que magic link/recovery), y el rol se deriva después, igual que con
 * OTP o password. `siguiente` viaja como `next` en el `redirectTo` para que
 * el callback vuelva exactamente donde el usuario intentaba entrar.
 */
export async function iniciarSesionConGoogle(siguiente: string) {
  const redirectTo = `${await origenActual()}/auth/callback?next=${encodeURIComponent(siguiente)}`;
  return googleProvider.login(redirectTo);
}

export async function iniciarSesionConContrasena(email: string, password: string) {
  const limite = await verificarRateLimitAuth(email, "password_login");
  if (!limite.ok) return { ok: false as const, error: limite.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  await registrarIntentoAuth(email, "password_login", !error);
  // Supabase ya devuelve un mensaje genérico ("Invalid login credentials")
  // que no distingue "no existe" de "contraseña incorrecta" — se conserva
  // tal cual, nunca se reemplaza por algo más específico (evita enumeración
  // de cuentas).
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function solicitarRecuperacion(email: string) {
  const limite = await verificarRateLimitAuth(email, "password_recovery");
  if (!limite.ok) return { ok: false as const, error: limite.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origenActual()}/auth/callback?next=${encodeURIComponent("/login/recuperar")}`,
  });
  await registrarIntentoAuth(email, "password_recovery", !error);
  // Nunca revelar si el email existe o no — siempre "ok" del lado del
  // usuario, el error real (si lo hay) solo se loguea server-side.
  if (error) console.error("[solicitarRecuperacion]", error.message);
  return { ok: true as const };
}

/**
 * Se llama desde `/login/recuperar`, con la sesión temporal que Supabase ya
 * estableció vía el link de recuperación (tipo "recovery", intercambiado en
 * `/auth/callback`) — nunca acepta la contraseña vieja ni un token del
 * cliente. Al confirmar, invalida TODAS las sesiones anteriores (Session
 * Version) — si alguien más tenía una sesión abierta con la contraseña
 * vieja, queda afuera en su siguiente request.
 */
export async function restablecerContrasena(password: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "El enlace de recuperación expiró — solicitá uno nuevo." };

  const validacion = await validarContrasenaNueva(user.id, password);
  if (!validacion.ok) return validacion;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false as const, error: error.message };

  await guardarEnHistorial(user.id, password);
  await supabase.from("perfil").update({ password_establecida: true }).eq("id", user.id);

  const admin = createAdminClient();
  await admin.rpc("incrementar_session_version", { p_user_id: user.id });

  return { ok: true as const };
}

/**
 * Auth_State_Machine.md: "Cuenta activa" → cambio de contraseña voluntario
 * (no recuperación). Exige la contraseña actual para evitar que una sesión
 * robada (ej. dispositivo desatendido) pueda tomar la cuenta cambiando la
 * contraseña sin conocerla.
 */
export async function cambiarContrasena(passwordActual: string, passwordNueva: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const, error: "Sesión inválida." };

  const { error: errorActual } = await supabase.auth.signInWithPassword({ email: user.email, password: passwordActual });
  if (errorActual) return { ok: false as const, error: "La contraseña actual no es correcta." };

  const validacion = await validarContrasenaNueva(user.id, passwordNueva);
  if (!validacion.ok) return validacion;

  const { error } = await supabase.auth.updateUser({ password: passwordNueva });
  if (error) return { ok: false as const, error: error.message };

  await guardarEnHistorial(user.id, passwordNueva);

  const admin = createAdminClient();
  await admin.rpc("incrementar_session_version", { p_user_id: user.id });

  return { ok: true as const };
}
