import { registrarAceptacionDeRegistro, registrarAceptacionLegal } from "@/lib/auth/aceptacion-legal";
import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { registrarEventoIdentidad } from "@/lib/auth/identity-events";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Destino del link "Iniciar sesión" del correo de OTP (02-UX/02_Onboarding.md,
 * 05-API/02_Auth.md). Clickear el link NO autentica nada por sí solo — esto es lo
 * que efectivamente intercambia el código PKCE por una sesión real y pone las
 * cookies. Sin esta ruta, el link llevaba a la home con un `?code=` suelto en la
 * URL que nadie consumía: el usuario aterrizaba sin sesión, viendo la app como
 * si no hubiera hecho nada.
 *
 * Zero-trust: el código es de un solo uso y el intercambio exige el `code_verifier`
 * guardado en cookie por el MISMO navegador que pidió el login (PKCE) — si un
 * escáner de seguridad del correo abre el link antes que la persona real, ese
 * intento falla ahí (no tiene la cookie) y el click genuino del usuario sigue
 * funcionando. El `next` pasa por el mismo validador que usa /login: nunca se
 * redirige a un dominio que no sea el propio.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Fase D: Google (y cualquier proveedor OAuth futuro) comparte este
      // mismo intercambio PKCE — se distingue del magic link/recovery por
      // `app_metadata.provider`, nunca por una rama de código separada.
      if (data.user.app_metadata?.provider === "google") {
        await registrarEventoIdentidad("GOOGLE_LOGIN", data.user.id, { email: data.user.email ?? null });
      }

      // Rediseño 2026-11-15: la aceptación legal se registra solo con evidencia real —
      //  · registro con contraseña confirmado por el enlace del correo: la aceptación marcada en
      //    el registro (metadatos con hora y versiones) se convierte en filas de aceptacion_legal;
      //  · cuenta nueva por Google (registro pendiente, sin casilla marcada): NO se acepta nada en
      //    silencio; la casilla se pide en «Completa tu perfil».
      // Las cuentas ya registradas siguen aceptando en silencio solo los cambios no materiales.
      const vinoDelRegistro = await registrarAceptacionDeRegistro(supabase, data.user);
      const registroPendiente = data.user.app_metadata?.registro_pendiente === true;
      const { pendientesMateriales } = registroPendiente
        ? { pendientesMateriales: [] }
        : await registrarAceptacionLegal(supabase, data.user.id);
      // ADR-015: el link de recuperación de contraseña (`solicitarRecuperacion()`,
      // next=/login/recuperar) nunca debe quedar atrapado detrás del desvío de
      // "completar perfil" — resetear la contraseña es más urgente y no requiere
      // tener teléfono cargado.
      const esRecuperacion = next === "/login/recuperar";
      // Cuenta nueva (Google o confirmación por enlace): primero «Completa tu perfil», que vive en
      // /login mientras el registro está pendiente (el proxy solo deja pasar /login, /auth y /legal).
      // Solo el registro con contraseña deja esos metadatos: la contraseña ya existe.
      if (vinoDelRegistro && registroPendiente) {
        await supabase.from("perfil").update({ password_establecida: true }).eq("id", data.user.id);
      }
      if (registroPendiente && !esRecuperacion) {
        return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}`);
      }

      // Mismo desvío de una sola vez que el flujo de código tipeado: sin teléfono
      // todavía, primero completa el perfil (02-UX/02_Onboarding.md).
      const { data: perfil } = await supabase
        .from("perfil")
        .select("telefono")
        .eq("id", data.user.id)
        .single();

      const destino = esRecuperacion || perfil?.telefono ? next : "/perfil?bienvenida=1";
      // Mismo bloqueo que el flujo de código tipeado (login/formulario.tsx): un
      // cambio legal material pendiente se resuelve antes que cualquier otro
      // destino (02-UX/10_Super_Admin.md) — salvo recuperación de contraseña,
      // que nunca debe quedar bloqueada por esto.
      if (!esRecuperacion && pendientesMateriales.length > 0) {
        return NextResponse.redirect(`${origin}/legal/aceptar?next=${encodeURIComponent(destino)}`);
      }
      return NextResponse.redirect(`${origin}${destino}`);
    }
    // El intercambio falló (código expirado o ya canjeado) — sin `user.id`
    // todavía, se audita sin actor.
    await registrarEventoIdentidad("CALLBACK_INVALIDO", null, { error: error?.message });
  } else if (searchParams.get("error")) {
    // Supabase redirige aquí con `?error=...` (sin `code`) cuando el propio
    // proveedor OAuth rechaza el login (ej. el usuario cancela el consentimiento
    // de Google) — nunca llega a `exchangeCodeForSession`.
    await registrarEventoIdentidad("OAUTH_ERROR", null, {
      error: searchParams.get("error"),
      descripcion: searchParams.get("error_description"),
    });
  }

  // Código inválido, expirado o ya canjeado (ej. clickeado dos veces, o un escaneo
  // automático de seguridad del cliente de correo lo consumió primero). Vuelve al
  // login sin sesión — nunca un crash ni una página en blanco.
  return NextResponse.redirect(`${origin}/login?error=magic_link_invalido`);
}
