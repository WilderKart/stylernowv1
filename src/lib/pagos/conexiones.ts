import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { cifrar, descifrar } from "./cifrado";
import { entornoPagos } from "./entorno";
import { estadoToken, type TokenPasarela } from "./mercadopago";
import { renovarToken } from "./oauth-mercadopago";

/**
 * Selección de la cuenta de cobro (migración 119).
 *
 * La base de datos decide en qué cuenta se cobra cada pago (`pago.cuenta_cobro`,
 * `pago.conexion_pago_id`, según el beneficiario de su tipo). Este módulo solo traduce esa
 * decisión a un token: el del vendedor (descifrado y renovado si hace falta) o, para la
 * cuenta PLATAFORMA, `undefined`, que el adaptador resuelve con el token de StylerNow.
 * Un pago del negocio NUNCA cae al token de la plataforma: si la conexión no sirve, falla.
 */

type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };
type FromSinTipos = {
  from: (t: string) => {
    select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } };
  };
};

interface FilaConexion {
  id: string;
  negocio_id: string;
  estado: string;
  access_token_cifrado: string | null;
  refresh_token_cifrado: string | null;
  token_expira_at: string | null;
  entorno: string | null;
  cuenta_externa_id: string | null;
}

/** Renueva cuando falten menos de 15 días (el token dura 180). */
const MARGEN_RENOVACION_MS = 15 * 86_400_000;

export class ConexionNoDisponible extends Error {}

async function leerConexion(conexionId: string): Promise<FilaConexion | null> {
  const admin = createAdminClient() as unknown as FromSinTipos;
  const { data } = await admin
    .from("conexion_pago_negocio")
    .select("id, negocio_id, estado, access_token_cifrado, refresh_token_cifrado, token_expira_at, entorno, cuenta_externa_id")
    .eq("id", conexionId)
    .maybeSingle();
  return (data as FilaConexion | null) ?? null;
}

async function marcar(conexionId: string, estado: "EXPIRADA" | "REVOCADA" | "ERROR", error: string) {
  await (createAdminClient() as unknown as RpcSinTipos).rpc("conexion_marcar_estado", {
    p_conexion_id: conexionId,
    p_estado: estado,
    p_error: error,
  });
}

/** Token vigente de una conexión de negocio. Lanza ConexionNoDisponible si no se puede usar. */
export async function tokenDeConexion(conexionId: string): Promise<string> {
  const c = await leerConexion(conexionId);
  if (!c || c.estado !== "CONECTADA" || !c.access_token_cifrado) {
    throw new ConexionNoDisponible("CONEXION_PAGO_NO_DISPONIBLE");
  }
  // Una conexión de sandbox nunca opera en producción ni al revés (directiva Sandbox, etapa 2).
  if (c.entorno !== entornoPagos()) {
    throw new ConexionNoDisponible("CONEXION_DE_OTRO_ENTORNO");
  }

  const expira = c.token_expira_at ? new Date(c.token_expira_at).getTime() : 0;
  if (expira - Date.now() > MARGEN_RENOVACION_MS) return descifrar(c.access_token_cifrado);

  if (!c.refresh_token_cifrado) {
    if (expira > Date.now()) return descifrar(c.access_token_cifrado);
    await marcar(c.id, "EXPIRADA", "TOKEN_VENCIDO_SIN_REFRESH");
    throw new ConexionNoDisponible("CONEXION_PAGO_EXPIRADA");
  }

  try {
    const t = await renovarToken(descifrar(c.refresh_token_cifrado));
    const { error } = await (createAdminClient() as unknown as RpcSinTipos).rpc("conexion_renovar_tokens", {
      p_conexion_id: c.id,
      p_access_cifrado: cifrar(t.accessToken),
      p_refresh_cifrado: t.refreshToken ? cifrar(t.refreshToken) : c.refresh_token_cifrado,
      p_expira_at: t.expiraAt,
    });
    if (error) throw new Error(error.message);
    return t.accessToken;
  } catch (e) {
    // Si aún no vence, se sigue usando el actual y se reintenta la renovación luego.
    if (expira > Date.now()) return descifrar(c.access_token_cifrado);
    const motivo = e instanceof Error ? e.message : "RENOVACION_FALLIDA";
    await marcar(c.id, motivo.includes("_400") || motivo.includes("_401") ? "REVOCADA" : "EXPIRADA", motivo);
    throw new ConexionNoDisponible("CONEXION_PAGO_EXPIRADA");
  }
}

export interface CuentaDePago {
  token: TokenPasarela;
  conexionId: string | null;
}

/** Token con el que se opera un pago ya creado (cobro, consulta, reembolso). */
export async function cuentaDePago(pagoId: string): Promise<CuentaDePago> {
  const admin = createAdminClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: { code?: string } | null }> };
      };
    };
  };
  const { data, error } = await admin.from("pago").select("cuenta_cobro, conexion_pago_id").eq("id", pagoId).maybeSingle();
  // Solo si la migración 119 aún no está aplicada (columna inexistente): en ese esquema todo
  // cobro en línea se hizo con la cuenta de StylerNow, así que es la única cuenta posible.
  if (error?.code === "42703") return { token: undefined, conexionId: null };
  if (error) throw new Error("PAGO_NO_LEIDO");
  const p = data as { cuenta_cobro: string | null; conexion_pago_id: string | null } | null;
  if (!p) throw new Error("PAGO_NO_ENCONTRADO");
  if (p.cuenta_cobro === "NEGOCIO") {
    if (!p.conexion_pago_id) throw new ConexionNoDisponible("PAGO_NEGOCIO_SIN_CONEXION");
    return { token: await tokenDeConexion(p.conexion_pago_id), conexionId: p.conexion_pago_id };
  }
  return { token: undefined, conexionId: null };
}

/** Marca la conexión según la respuesta de la API (401/403 = credencial revocada por el vendedor). */
export async function reportarFalloConexion(conexionId: string | null, status: number, mensaje: string) {
  if (!conexionId) return;
  if (status === 401 || status === 403) await marcar(conexionId, "REVOCADA", mensaje);
}

/** Cuenta del vendedor (user_id en Mercado Pago) de una conexión: se compara con el collector_id del pago. */
export async function cuentaVendedorDeConexion(conexionId: string): Promise<string | null> {
  const c = await leerConexion(conexionId);
  return c?.cuenta_externa_id ?? null;
}

/**
 * Conexiones CONECTADAS de una cuenta de Mercado Pago (user_id del vendedor) en el entorno actual.
 * La usa el webhook cuando la notificación llega por la URL del panel (sin `?c=`): el `user_id`
 * de la notificación NO se cree por sí solo; solo dice con qué token consultar, y después se exige
 * que el `pago` esté ligado a una de estas conexiones y que el collector del pago sea esa cuenta.
 */
export async function conexionesDeCuenta(cuentaExternaId: string): Promise<string[]> {
  if (!/^\d{1,20}$/.test(cuentaExternaId)) return [];
  const admin = createAdminClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } };
      };
    };
  };
  const { data, error } = await admin
    .from("conexion_pago_negocio")
    .select("id")
    .eq("cuenta_externa_id", cuentaExternaId)
    .eq("estado", "CONECTADA")
    .eq("entorno", entornoPagos());
  if (error) throw new Error("CONEXIONES_NO_LEIDAS");
  return ((data ?? []) as { id: string }[]).map((f) => f.id);
}

/**
 * Aviso mp-connect (vinculación/desvinculación). No se le cree al aviso: se busca la conexión de esa
 * cuenta y se consulta a Mercado Pago con su token; solo si el proveedor lo rechaza se marca REVOCADA.
 */
export async function revisarConexionPorCuenta(cuentaExternaId: string): Promise<"REVOCADA" | "VIGENTE" | "SIN_CONEXION" | "DESCONOCIDO"> {
  if (!/^\d{1,20}$/.test(cuentaExternaId)) return "SIN_CONEXION";
  const admin = createAdminClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ data: unknown[] | null }> } };
    };
  };
  const { data } = await admin.from("conexion_pago_negocio").select("id").eq("cuenta_externa_id", cuentaExternaId).eq("estado", "CONECTADA");
  const filas = (data ?? []) as { id: string }[];
  if (filas.length === 0) return "SIN_CONEXION";
  let resultado: "REVOCADA" | "VIGENTE" | "DESCONOCIDO" = "VIGENTE";
  for (const f of filas) {
    let token: string;
    try {
      token = await tokenDeConexion(f.id);
    } catch {
      continue;
    }
    const estado = await estadoToken(token);
    if (estado === "REVOCADO") {
      await marcar(f.id, "REVOCADA", "DESVINCULADA_POR_EL_VENDEDOR");
      resultado = "REVOCADA";
    } else if (estado === "DESCONOCIDO" && resultado !== "REVOCADA") {
      resultado = "DESCONOCIDO";
    }
  }
  return resultado;
}
