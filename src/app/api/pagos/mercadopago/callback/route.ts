import { cifrar, descifrar } from "@/lib/pagos/cifrado";
import { canjearCodigo, esSandbox, hashEstado } from "@/lib/pagos/oauth-mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

/**
 * GET /api/pagos/mercadopago/callback — Mercado Pago vuelve aquí con `code` y `state`.
 *
 * Se verifica que haya sesión, que el `state` exista, no esté usado ni vencido y pertenezca a
 * ESTE usuario (anti-CSRF: nadie puede conectar su cuenta de Mercado Pago a un negocio ajeno
 * mandándole un enlace). El código se canjea en el servidor y los tokens se guardan cifrados.
 * Ningún token ni código aparece en logs ni en la URL de vuelta.
 */
export async function GET(request: NextRequest) {
  const volver = new URL("/panel/cobros", request.nextUrl.origin);
  const fallo = (codigo: string) => {
    volver.searchParams.set("error", codigo);
    return NextResponse.redirect(volver);
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || state.length > 200) return fallo("RESPUESTA_INVALIDA");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fallo("SESION_EXPIRADA");

  const admin = createAdminClient() as unknown as RpcSinTipos;
  const { data: estado, error: eEstado } = await admin.rpc("oauth_consumir", {
    p_state_hash: hashEstado(state),
    p_actor: user.id,
  });
  const fila = (Array.isArray(estado) ? estado[0] : estado) as { negocio_id: string; verifier_cifrado: string } | undefined;
  if (eEstado || !fila) return fallo("ESTADO_INVALIDO");

  try {
    const t = await canjearCodigo(code, descifrar(fila.verifier_cifrado));
    const { error } = await admin.rpc("conexion_guardar", {
      p_negocio_id: fila.negocio_id,
      p_actor: user.id,
      p_cuenta_externa: t.cuentaExternaId,
      p_entorno: esSandbox() ? "SANDBOX" : "PRODUCCION",
      p_access_cifrado: cifrar(t.accessToken),
      p_refresh_cifrado: t.refreshToken ? cifrar(t.refreshToken) : null,
      p_expira_at: t.expiraAt,
      p_scopes: t.scopes,
    });
    if (error) return fallo("NO_SE_GUARDO");
  } catch (e) {
    console.error("[oauth mercadopago] canje fallido", e instanceof Error ? e.message : "error");
    return fallo("CANJE_FALLIDO");
  }

  volver.searchParams.set("ok", "1");
  return NextResponse.redirect(volver);
}
