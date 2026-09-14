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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Código inválido, expirado o ya canjeado (ej. clickeado dos veces, o un escaneo
  // automático de seguridad del cliente de correo lo consumió primero). Vuelve al
  // login sin sesión — nunca un crash ni una página en blanco.
  return NextResponse.redirect(`${origin}/login?error=magic_link_invalido`);
}
