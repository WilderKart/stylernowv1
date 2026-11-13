import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { cifrar } from "@/lib/pagos/cifrado";
import { nuevoEstadoOAuth, oauthConfigurado, urlAutorizacion } from "@/lib/pagos/oauth-mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

/**
 * GET /api/pagos/mercadopago/conectar — inicia la conexión de la cuenta de Mercado Pago del negocio.
 *
 * Cero confianza: el negocio sale de la sesión verificada en el servidor (nunca de la URL).
 * El `state` es aleatorio, de un solo uso, vence en 10 minutos y queda ligado al dueño; en la
 * base solo se guarda su hash. El verificador PKCE se guarda cifrado.
 */
export async function GET(request: NextRequest) {
  const volver = new URL("/panel/cobros", request.nextUrl.origin);

  if (!oauthConfigurado()) {
    volver.searchParams.set("error", "NO_CONFIGURADO");
    return NextResponse.redirect(volver);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/panel/cobros", request.nextUrl.origin));

  const contexto = await resolverContexto();
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId || contexto.userId !== user.id) {
    volver.searchParams.set("error", "NO_AUTORIZADO");
    return NextResponse.redirect(volver);
  }

  const { state, stateHash, verifier } = nuevoEstadoOAuth();
  const { error } = await (createAdminClient() as unknown as RpcSinTipos).rpc("oauth_iniciar", {
    p_actor: user.id,
    p_negocio_id: contexto.negocioId,
    p_state_hash: stateHash,
    p_verifier_cifrado: cifrar(verifier),
  });
  if (error) {
    volver.searchParams.set("error", "NO_AUTORIZADO");
    return NextResponse.redirect(volver);
  }

  return NextResponse.redirect(urlAutorizacion(state, verifier));
}
