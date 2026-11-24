"use server";

import { idsTextosVigentes, registrarAceptacionDeRegistro, registrarAceptacionLegal } from "@/lib/auth/aceptacion-legal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarContrasenaNueva } from "@/lib/auth/password-validator";
import { validarPolitica } from "@/lib/auth/password-policy";
import { guardarEnHistorial } from "@/lib/auth/password-history";
import { registrarIntentoAuth, verificarRateLimitAuth } from "@/lib/auth/rate-limit-auth";
import { googleProvider } from "@/lib/auth/providers/google-provider";
import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { esCategoriaRegistro } from "@/lib/tema/vertical";
import { destinoInicial, destinoPorIntencion, fijarIntencionRegistro } from "@/lib/auth/destino-inicial";
import { fijarAspectoDeCuenta, fijarCategoriaAspecto } from "@/lib/tema/categoria-cookie";
import { obtenerInvitacionPendiente } from "@/lib/invitaciones/invitacion-pendiente";
import { limitar, ipDelLlamador } from "@/lib/rate-limit";
import { MENSAJE_TURNSTILE, verificarTurnstile } from "@/lib/seguridad/turnstile";
import * as Sentry from "@sentry/nextjs";
import { cookies, headers } from "next/headers";
import { z } from "zod";

/**
 * Dominio de la request actual, no un valor fijo de env: Vercel sirve este proyecto
 * bajo más de un alias (el corto y el largo con el hash del team), y el link del
 * correo tiene que volver exactamente por donde entró el usuario. Cualquier alias
 * que se use aquí debe estar en Supabase → Authentication → URL Configuration →
 * Redirect URLs, si no Supabase rechaza el `emailRedirectTo`.
 */
async function origenActual() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

const CORREO = z.string().trim().toLowerCase().max(254).email();
/** Tipo de cuenta del registro: solo enruta (ver destino-inicial.ts), nunca otorga permisos. */
const TIPO_CUENTA = z.enum(["cliente", "negocio"]);

/** Límite por IP y por correo para todo lo que envía un correo de Auth (registro y reenvío). */
async function limitarEnvioCorreo(email: string) {
  const limite = await verificarRateLimitAuth(email, "otp_envio");
  if (!limite.ok) return limite;
  const porIp = await limitar("otp-ip", await ipDelLlamador(), 8, 600, { failClosed: true });
  const porCorreo = await limitar("otp-correo", email, 5, 600, { failClosed: true });
  if (!porIp.ok || !porCorreo.ok) {
    const espera = Math.max(!porIp.ok ? porIp.retryAfter : 0, !porCorreo.ok ? porCorreo.retryAfter : 0);
    return { ok: false as const, error: `Demasiados intentos. Espera ${Math.ceil(espera / 60)} min y vuelve a intentarlo.` };
  }
  return { ok: true as const };
}

/**
 * CREAR CUENTA (rediseño 2026-11-15): correo + contraseña + confirmación + aceptación legal.
 * Todo se valida aquí (la UI solo da aviso inmediato). La contraseña se crea EN el registro;
 * Supabase deja la cuenta sin confirmar y envía el código de verificación ("Confirm signup").
 *
 * Anti-enumeración: si el correo ya tiene cuenta (Supabase devuelve un usuario ficticio o
 * "User already registered" según la versión), se responde igual que para una nueva — la persona
 * ve la pantalla de verificación en ambos casos y nunca se le dice "ese correo ya existe".
 */
export async function registrarCuenta(datos: {
  tipo: unknown;
  /** Tipo de negocio (negocio) o servicio que busca (cliente). */
  categoria?: unknown;
  email: string;
  password: string;
  confirmar: string;
  aceptaTerminos: boolean;
  siguiente: string;
  turnstile?: unknown;
  invitacion?: unknown;
}): Promise<
  | { ok: true; email: string; siguiente: string }
  | { ok: false; campo?: "tipo" | "categoria" | "email" | "password" | "confirmar" | "terminos"; error: string }
> {
  // Staff invitado: el correo y el destino salen de la invitación PENDIENTE (servidor), no del formulario.
  const invitacion = datos.invitacion === undefined ? null : await obtenerInvitacionPendiente(datos.invitacion);
  if (datos.invitacion !== undefined && !invitacion) {
    return { ok: false, error: "Esta invitación ya no está disponible. Pídele a quien te invitó que te envíe una nueva." };
  }
  const tipo = invitacion ? ({ success: true, data: "staff" } as const) : TIPO_CUENTA.safeParse(datos.tipo);
  if (!tipo.success) return { ok: false, campo: "tipo", error: "Elige qué tipo de cuenta quieres crear." };
  // La categoría solo da aspecto y preselección (nunca permisos). Un negocio debe elegirla; un cliente puede omitirla.
  const categoria = esCategoriaRegistro(datos.categoria) ? datos.categoria : null;
  if (tipo.data === "negocio" && !categoria) return { ok: false, campo: "categoria", error: "Elige el tipo de negocio." };
  const correo = CORREO.safeParse(invitacion ? invitacion.email : datos.email);
  if (!correo.success) return { ok: false, campo: "email", error: "Escribe un correo válido." };
  const email = correo.data;
  if (datos.aceptaTerminos !== true) {
    return { ok: false, campo: "terminos", error: "Debes aceptar los Términos y la Política de Tratamiento de Datos." };
  }
  if (typeof datos.password !== "string" || datos.password !== datos.confirmar) {
    return { ok: false, campo: "confirmar", error: "Las contraseñas no coinciden." };
  }
  const politica = await validarPolitica(datos.password);
  if (!politica.ok) return { ok: false, campo: "password", error: politica.error };

  // Anti-bots (Cloudflare Turnstile), verificado aquí con la clave secreta; antes de enviar ningún correo.
  if (!(await verificarTurnstile(datos.turnstile, "registro"))) return { ok: false, error: MENSAJE_TURNSTILE };

  const limite = await limitarEnvioCorreo(email);
  if (!limite.ok) return { ok: false, error: limite.error };

  const supabase = await createClient();
  // Versiones exactas mostradas al registrarse. La aceptación se guarda en el servidor (migración 146)
  // con la hora del servidor; en los metadatos solo quedan los ids, para enrutar tras verificar.
  const versiones = await idsTextosVigentes(supabase);
  // El destino lo decide el servidor a partir del tipo validado (no se confía en el `next` del navegador).
  const siguiente = invitacion ? `/invitacion/${invitacion.id}` : destinoPorIntencion(tipo.data, destinoSeguro(datos.siguiente));
  const { data, error } = await supabase.auth.signUp({
    email,
    password: datos.password,
    options: {
      emailRedirectTo: `${await origenActual()}/auth/callback?next=${encodeURIComponent(siguiente)}`,
      data: { acepta_legal_ids: versiones },
    },
  });
  await registrarIntentoAuth(email, "otp_envio", !error);
  // Correo ya registrado: misma respuesta que una cuenta nueva (anti-enumeración). No se envía
  // código ni se toca la cuenta existente; en la verificación, «Reenviar» tampoco revela nada.
  if (error && (error.code === "user_already_exists" || /already (registered|exists)/i.test(error.message))) {
    return { ok: true, email, siguiente };
  }
  if (error) {
    if (/password/i.test(error.message)) return { ok: false, campo: "password", error: "Esa contraseña no cumple los requisitos. Elige otra." };
    if (/rate limit|too many/i.test(error.message)) return { ok: false, error: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." };
    console.error("[registrarCuenta]", error.message);
    return { ok: false, error: "No pudimos crear tu cuenta. Intenta de nuevo en unos minutos." };
  }
  // Solo una cuenta realmente nueva trae identidades; con un correo existente Supabase devuelve
  // un usuario ficticio sin identidades — no se toca nada y se responde igual.
  // La intención se guarda SOLO en una cuenta realmente nueva: un correo existente no cambia nada.
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    await guardarEnHistorial(data.user.id, datos.password);
    await fijarIntencionRegistro(data.user.id, tipo.data, categoria);
    await fijarCategoriaAspecto(categoria); // solo aspecto: la pantalla de verificación y el onboarding ya salen con el diseño elegido
    // Cliente: el servicio que busca queda como interés del perfil (la app se adapta a él).
    if (tipo.data === "cliente" && categoria) {
      await createAdminClient().from("perfil").update({ categorias_interes: [categoria] }).eq("id", data.user.id);
    }
    // Evidencia de la casilla marcada: en el mismo instante y con la hora del servidor.
    const { error: eAcepta } = await (createAdminClient() as unknown as { rpc: (n: string, a: object) => Promise<{ error: { message: string } | null }> }).rpc(
      "registrar_aceptacion_legal_registro",
      { p_usuario: data.user.id, p_texto_ids: versiones }
    );
    if (eAcepta) console.error("[registrarCuenta] aceptación legal no registrada", eAcepta.message);
  }
  return { ok: true, email, siguiente };
}

/**
 * VERIFICA TU CORREO: canjea el código del correo "Confirm signup". Al confirmarse, la sesión
 * queda abierta, se registra la aceptación legal hecha en el registro y la contraseña ya creada.
 * Devuelve a dónde ir: el Super Admin a su panel; cualquier otra cuenta al paso "Completa tu perfil".
 */
export async function verificarCorreo(
  emailCrudo: string,
  codigoCrudo: string
): Promise<{ ok: true; esSupersu: boolean } | { ok: false; error: string }> {
  const correo = CORREO.safeParse(emailCrudo);
  const codigo = String(codigoCrudo ?? "").replace(/\D/g, "");
  if (!correo.success) return { ok: false, error: "Escribe un correo válido." };
  if (codigo.length < 6 || codigo.length > 10) return { ok: false, error: "El código tiene 6 dígitos." };
  const email = correo.data;

  const limite = await verificarRateLimitAuth(email, "otp_verificacion");
  if (!limite.ok) return { ok: false, error: limite.error };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: codigo, type: "email" });
  await registrarIntentoAuth(email, "otp_verificacion", !error);
  if (error || !data.user) {
    // Mismo mensaje para código equivocado, vencido o ya usado (Supabase no los distingue de forma fiable).
    return { ok: false, error: "El código no es correcto o ya venció. Revísalo o pide uno nuevo." };
  }

  if (await esSupersuCuenta(supabase, data.user.id)) return { ok: true, esSupersu: true };

  await registrarAceptacionDeRegistro(supabase, data.user);
  // Los textos no materiales que no cubrió el registro se aceptan como siempre; un cambio material
  // pendiente lo resuelve /legal/aceptar después del perfil.
  await registrarAceptacionLegal(supabase, data.user.id);
  // La contraseña se creó en el registro: el perfil lo refleja (columna no sensible, RLS propia).
  await supabase.from("perfil").update({ password_establecida: true }).eq("id", data.user.id);
  return { ok: true, esSupersu: false };
}

/**
 * Reenvía el código de verificación. Respuesta siempre genérica (no revela si el correo existe ni
 * si ya estaba verificado) y con el mismo límite de envíos que el registro.
 */
export async function reenviarCodigoVerificacion(emailCrudo: string, siguienteCrudo = "/"): Promise<{ ok: true } | { ok: false; error: string }> {
  const correo = CORREO.safeParse(emailCrudo);
  if (!correo.success) return { ok: false, error: "Escribe un correo válido." };
  const email = correo.data;
  const limite = await limitarEnvioCorreo(email);
  if (!limite.ok) return { ok: false, error: limite.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await origenActual()}/auth/callback?next=${encodeURIComponent(destinoSeguro(siguienteCrudo))}` },
  });
  await registrarIntentoAuth(email, "otp_envio", !error);
  if (error) {
    if (/rate limit|too many|seconds/i.test(error.message)) return { ok: false, error: "Espera un momento antes de pedir otro código." };
    console.error("[reenviarCodigoVerificacion]", error.message);
  }
  return { ok: true };
}

/** Lee es_supersu del perfil de la sesión (el valor solo se fija desde la base, migración 136). */
async function esSupersuCuenta(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("perfil").select("es_supersu").eq("id", userId).maybeSingle();
  return data?.es_supersu === true;
}

/**
 * Auth_State_Machine.md: "OTP Verificado" → "Contraseña creada". Requiere
 * una sesión ya activa (hoy: cuentas creadas con Google que quieren añadir contraseña desde /perfil) —
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
  if (!user) return { ok: false as const, error: "Sesión inválida — vuelve a iniciar sesión." };

  const { data: perfil } = await supabase.from("perfil").select("password_establecida").eq("id", user.id).single();
  if (perfil?.password_establecida) {
    return { ok: false as const, error: "Ya tienes una contraseña — usa 'Cambiar contraseña' e ingresa la actual." };
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
 * Fase D — el rol NUNCA se decide aquí ni en Google: `login()` solo devuelve
 * la URL de Google, el intercambio real pasa por `/auth/callback` (mismo
 * camino que magic link/recovery), y el rol se deriva después, igual que con
 * OTP o password. `siguiente` viaja como `next` en el `redirectTo` para que
 * el callback vuelva exactamente donde el usuario intentaba entrar.
 */
export async function iniciarSesionConGoogle(siguienteCrudo: string, tipoCrudo?: unknown, categoriaCrudo?: unknown) {
  // Desde «Crear cuenta» llega el tipo elegido: el servidor arma el `next` (onboarding o destino de
  // cliente). El callback solo lo usa para enrutar y, en una cuenta nueva, para guardar la intención.
  const tipo = tipoCrudo === undefined ? null : TIPO_CUENTA.safeParse(tipoCrudo);
  if (tipo && !tipo.success) return { ok: false as const, error: "Elige qué tipo de cuenta quieres crear." };
  const siguiente = tipo ? destinoPorIntencion(tipo.data, destinoSeguro(siguienteCrudo)) : destinoSeguro(siguienteCrudo);
  // Categoría elegida (solo aspecto y preselección): cookie de 30 min que /auth/callback consume al crear la cuenta.
  if (tipo?.success && esCategoriaRegistro(categoriaCrudo)) {
    (await cookies()).set("sn_cat_reg", categoriaCrudo, { path: "/", maxAge: 60 * 30, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  const redirectTo = `${await origenActual()}/auth/callback?next=${encodeURIComponent(siguiente)}`;
  return googleProvider.login(redirectTo);
}

/**
 * INGRESAR: el único ingreso habitual es correo + contraseña (el código por correo ya no es un
 * método de ingreso; solo verifica el correo al registrarse).
 *
 * Anti-enumeración: "no existe" y "contraseña incorrecta" dan el MISMO mensaje. "Correo sin
 * verificar" solo se distingue cuando la contraseña es correcta (Supabase valida la contraseña
 * antes que la confirmación), así que no revela nada a quien no conoce la contraseña.
 */
export async function iniciarSesionConContrasena(emailCrudo: string, password: string, siguienteCrudo = "/", turnstile?: unknown) {
  const correo = CORREO.safeParse(emailCrudo);
  if (!correo.success || !password) return { ok: false as const, error: "Correo o contraseña incorrectos." };
  const email = correo.data;
  if (!(await verificarTurnstile(turnstile, "ingreso"))) return { ok: false as const, error: MENSAJE_TURNSTILE };

  const limite = await verificarRateLimitAuth(email, "password_login");
  if (!limite.ok) return { ok: false as const, error: limite.error };
  const porIp = await limitar("login-ip", await ipDelLlamador(), 30, 600, { failClosed: true });
  if (!porIp.ok) return { ok: false as const, error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  await registrarIntentoAuth(email, "password_login", !error);
  if (error) {
    if (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message)) {
      return { ok: false as const, sinVerificar: true as const, error: "Tu correo todavía no está verificado." };
    }
    return { ok: false as const, error: "Correo o contraseña incorrectos." };
  }
  const esSupersu = data.user ? await esSupersuCuenta(supabase, data.user.id) : false;
  if (data.user) await fijarAspectoDeCuenta(supabase, data.user);
  const siguiente = destinoSeguro(siguienteCrudo);
  // Destino resuelto en el servidor: quien se registró como negocio y dejó el onboarding a medias lo
  // retoma aquí; el Super Admin va a /admin (su rol solo viene de la base de datos).
  const destino = esSupersu ? (siguiente !== "/" ? siguiente : "/admin") : await destinoInicial(supabase, data.user, siguiente);
  return { ok: true as const, esSupersu, destino };
}

export async function solicitarRecuperacion(emailCrudo: string, turnstile?: unknown) {
  const correo = CORREO.safeParse(emailCrudo);
  if (!correo.success) return { ok: false as const, error: "Escribe un correo válido." };
  const email = correo.data;
  if (!(await verificarTurnstile(turnstile, "recuperar"))) return { ok: false as const, error: MENSAJE_TURNSTILE };
  const porIp = await limitar("recuperar-ip", await ipDelLlamador(), 8, 600, { failClosed: true });
  if (!porIp.ok) return { ok: false as const, error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." };
  const limite = await verificarRateLimitAuth(email, "password_recovery");
  if (!limite.ok) return { ok: false as const, error: limite.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origenActual()}/auth/callback?next=${encodeURIComponent("/login/recuperar")}`,
  });
  await registrarIntentoAuth(email, "password_recovery", !error);
  // Nunca revelar si el email existe o no — siempre "ok" del lado del
  // usuario; el error real se registra server-side para poder diagnosticar
  // fallos de SMTP/entrega sin filtrar nada a la pantalla.
  if (error) {
    console.error("[solicitarRecuperacion]", error.message);
    Sentry.captureException(error, { tags: { flujo: "recuperacion_contrasena" } });
  }
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
  if (!user) return { ok: false as const, error: "El enlace de recuperación expiró — solicita uno nuevo." };

  const validacion = await validarContrasenaNueva(user.id, password);
  if (!validacion.ok) return validacion;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false as const, error: error.message };

  await guardarEnHistorial(user.id, password);
  await supabase.from("perfil").update({ password_establecida: true }).eq("id", user.id);

  const admin = createAdminClient();
  await admin.rpc("incrementar_session_version", { p_user_id: user.id });
  // Cierra todas las sesiones (incluida la temporal del enlace): se vuelve a ingresar con la contraseña nueva.
  await supabase.auth.signOut({ scope: "global" });

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
