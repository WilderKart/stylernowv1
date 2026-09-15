import { registrarAceptacionLegal } from "@/lib/auth/aceptacion-legal";
import { destinoSeguro } from "@/lib/auth/destino-seguro";
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
      // El botón del correo ya implica la misma aceptación que exige el paso 1 del
      // formulario (enviarCodigo la valida server-side antes de mandar el correo);
      // se registra acá porque este camino nunca pasa por verificarCodigo.
      await registrarAceptacionLegal(supabase, data.user.id);

      // Mismo desvío de una sola vez que el flujo de código tipeado: sin teléfono
      // todavía, primero completa el perfil (02-UX/02_Onboarding.md).
      const { data: perfil } = await supabase
        .from("perfil")
        .select("telefono")
        .eq("id", data.user.id)
        .single();

      const destino = perfil?.telefono ? next : "/perfil?bienvenida=1";
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  // Código inválido, expirado o ya canjeado (ej. clickeado dos veces, o un escaneo
  // automático de seguridad del cliente de correo lo consumió primero). Vuelve al
  // login sin sesión — nunca un crash ni una página en blanco.
  return NextResponse.redirect(`${origin}/login?error=magic_link_invalido`);
}
