import { registrarAceptacionDeRegistro, registrarAceptacionLegal } from "@/lib/auth/aceptacion-legal";
import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { destinoInicial, fijarIntencionRegistro, intencionDe, RUTA_ONBOARDING } from "@/lib/auth/destino-inicial";
import { registrarEventoIdentidad } from "@/lib/auth/identity-events";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Destino del link "Iniciar sesión" del correo de OTP (02-UX/02_Onboarding.md,
 * 05-API/02_Auth.md). Clickear el link NO autentica nada por sí solo.
 *
 * Dos formas de canjear, según la plantilla del correo:
 *  · `?code=` + PKCE (OAuth de Google, magic link/recovery clásico): exige el
 *    `code_verifier` guardado en cookie por el MISMO navegador que pidió el login,
 *    así que un escáner de seguridad del correo que abra el link antes que la
 *    persona real no lo consume.
 *  · `?token_hash=...&type=...` (recovery y demás enlaces con token): `verifyOtp`
 *    no depende de ninguna cookie de ese navegador, por lo que el enlace de
 *    recuperación funciona aunque se abra en otro navegador o dispositivo.
 *
 * El `next` pasa por el mismo validador que usa /login: nunca se redirige a un
 * dominio que no sea el propio.
 */
const TIPOS_OTP = new Set<EmailOtpType>(["recovery", "email", "signup", "magiclink", "invite", "email_change"]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");
  const next = destinoSeguro(searchParams.get("next"));

  const supabase = await createClient();
  let user: User | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Fase D: Google (y cualquier proveedor OAuth futuro) comparte este
      // mismo intercambio PKCE — se distingue del magic link/recovery por
      // `app_metadata.provider`, nunca por una rama de código separada.
      if (data.user.app_metadata?.provider === "google") {
        await registrarEventoIdentidad("GOOGLE_LOGIN", data.user.id, { email: data.user.email ?? null });
      }
      user = data.user;
    } else {
      // El intercambio falló (código expirado o ya canjeado) — sin `user.id`
      // todavía, se audita sin actor.
      await registrarEventoIdentidad("CALLBACK_INVALIDO", null, { error: error.message });
    }
  } else if (tokenHash && tipo && TIPOS_OTP.has(tipo as EmailOtpType)) {
    const { data, error } = await supabase.auth.verifyOtp({ type: tipo as EmailOtpType, token_hash: tokenHash });
    if (!error && data.user) {
      user = data.user;
    } else {
      await registrarEventoIdentidad("CALLBACK_INVALIDO", null, { error: error?.message ?? null });
    }
  } else if (searchParams.get("error")) {
    // Supabase redirige aquí con `?error=...` (sin `code`) cuando el propio
    // proveedor OAuth rechaza el login (ej. el usuario cancela el consentimiento
    // de Google) — nunca llega a `exchangeCodeForSession`.
    await registrarEventoIdentidad("OAUTH_ERROR", null, {
      error: searchParams.get("error"),
      descripcion: searchParams.get("error_description"),
    });
  }

  if (user) {
    // Rediseño 2026-11-15: la aceptación legal se registra solo con evidencia real —
    //  · registro con contraseña confirmado por el enlace del correo: la aceptación marcada en
    //    el registro (metadatos con hora y versiones) se convierte en filas de aceptacion_legal;
    //  · cuenta nueva por Google (registro pendiente, sin casilla marcada): NO se acepta nada en
    //    silencio; la casilla se pide en «Completa tu perfil».
    // Las cuentas ya registradas siguen aceptando en silencio solo los cambios no materiales.
    const vinoDelRegistro = await registrarAceptacionDeRegistro(supabase, user);
    const registroPendiente = user.app_metadata?.registro_pendiente === true;
    const { pendientesMateriales } = registroPendiente
      ? { pendientesMateriales: [] }
      : await registrarAceptacionLegal(supabase, user.id);
    // ADR-015: el link de recuperación de contraseña (`solicitarRecuperacion()`,
    // next=/login/recuperar) nunca debe quedar atrapado detrás del desvío de
    // "completar perfil" — resetear la contraseña es más urgente y no requiere
    // tener teléfono cargado.
    const esRecuperacion = next === "/login/recuperar";
    // Cuenta nueva (Google o confirmación por enlace): primero «Completa tu perfil», que vive en
    // /login mientras el registro está pendiente (el proxy solo deja pasar /login, /auth y /legal).
    // Solo el registro con contraseña deja esos metadatos: la contraseña ya existe.
    if (vinoDelRegistro && registroPendiente) {
      await supabase.from("perfil").update({ password_establecida: true }).eq("id", user.id);
    }
    // Cuenta nueva por Google desde «Crear cuenta»: la intención llega en el `next` que armó el
    // servidor (onboarding = negocio). Solo enruta — no da permisos — y solo se fija una vez, en una
    // cuenta todavía pendiente; una cuenta existente nunca cambia de intención por un `next`.
    if (registroPendiente && !esRecuperacion && intencionDe(user) === null) {
      await fijarIntencionRegistro(user.id, next.startsWith(RUTA_ONBOARDING) ? "negocio" : "cliente");
    }
    if (registroPendiente && !esRecuperacion) {
      return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}`);
    }

    // Mismo desvío de una sola vez que el flujo de código tipeado: sin teléfono
    // todavía, primero completa el perfil (02-UX/02_Onboarding.md).
    const { data: perfil } = await supabase
      .from("perfil")
      .select("telefono")
      .eq("id", user.id)
      .single();

    const destino = esRecuperacion
      ? next
      : perfil?.telefono
        ? await destinoInicial(supabase, user, next)
        : "/perfil?bienvenida=1";
    // Mismo bloqueo que el flujo de código tipeado (login/formulario.tsx): un
    // cambio legal material pendiente se resuelve antes que cualquier otro
    // destino (02-UX/10_Super_Admin.md) — salvo recuperación de contraseña,
    // que nunca debe quedar bloqueada por esto.
    if (!esRecuperacion && pendientesMateriales.length > 0) {
      return NextResponse.redirect(`${origin}/legal/aceptar?next=${encodeURIComponent(destino)}`);
    }
    return NextResponse.redirect(`${origin}${destino}`);
  }

  // Código/token inválido, expirado o ya canjeado (ej. clickeado dos veces, o un
  // escaneo automático de seguridad del cliente de correo lo consumió primero).
  // Vuelve al login sin sesión — nunca un crash ni una página en blanco.
  return NextResponse.redirect(`${origin}/login?error=magic_link_invalido`);
}
