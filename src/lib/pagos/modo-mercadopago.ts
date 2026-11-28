import "server-only";
import { entornoPagos } from "./entorno";

export type Nivel = "ok" | "alerta" | "falla";

/**
 * Modo real de Mercado Pago, sin mostrar ningún valor secreto: entorno que decide el servidor, tipo de credencial (solo el
 * prefijo) y, preguntándole a Mercado Pago de quién es el token, si la cuenta es de prueba o real.
 */
export async function modoMercadoPago(): Promise<{ nivel: Nivel; detalle: string }> {
  let entorno: string;
  try {
    entorno = entornoPagos();
  } catch (e) {
    return { nivel: "falla", detalle: e instanceof Error ? e.message : "Entorno inválido" };
  }
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";
  const clave = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() ?? "";
  const tipo = (v: string) => (v.startsWith("TEST-") ? "TEST-" : v.startsWith("APP_USR-") ? "APP_USR-" : v ? "otro" : "falta");
  let cuenta = "no se pudo consultar";
  let esPrueba: boolean | null = null;
  if (token) {
    try {
      const r = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const u = (await r.json()) as { nickname?: string; site_id?: string; tags?: string[] };
        esPrueba = /^TEST/i.test(u.nickname ?? "") || (u.tags ?? []).includes("test_user");
        cuenta = `${esPrueba ? "cuenta de PRUEBA" : "cuenta REAL"} (${u.site_id ?? "?"})`;
      } else {
        cuenta = `Mercado Pago respondió ${r.status} al validar el token`;
      }
    } catch {
      cuenta = "sin respuesta de Mercado Pago";
    }
  }
  const coherente = entorno === "SANDBOX" ? esPrueba !== false : esPrueba !== true;
  return {
    nivel: !token ? "falla" : coherente ? "ok" : "falla",
    detalle: `Entorno del servidor: ${entorno} · token ${tipo(token)} · clave pública ${tipo(clave)} · ${cuenta}${coherente ? "" : " · NO COINCIDEN: los pagos se rechazarán"}`,
  };
}
