import "server-only";
import { createECDH } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { b64urlCodificar, cargarClavesVapid, type ClavesVapid } from "./web-push";

/**
 * Claves VAPID del servidor. Orden de búsqueda:
 *  1. Variables de entorno VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (si están completas y coherentes, mandan).
 *  2. Vault de la base (migración 198): el par se genera UNA vez, aquí, y se guarda cifrado. Nunca se imprime ni se registra.
 * Solo la clave pública sale hacia el navegador. La privada vive únicamente en el servidor.
 */
const SUJETO_POR_DEFECTO = "mailto:equipo@stylernow.com";
const VIGENCIA_CACHE_MS = 10 * 60 * 1000;

type RpcSinTipos = {
  rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
};

let cache: { claves: ClavesVapid; hasta: number } | null = null;

function filaDe(data: unknown): { publica?: string | null; privada?: string | null } {
  const f = Array.isArray(data) ? data[0] : data;
  return f && typeof f === "object" ? (f as { publica?: string | null; privada?: string | null }) : {};
}

async function leerDeVault(admin: RpcSinTipos) {
  const { data, error } = await admin.rpc("push_vapid_leer");
  if (error) return null;
  const f = filaDe(data);
  return f.publica && f.privada ? { publica: f.publica, privada: f.privada } : null;
}

export async function obtenerClavesVapid(): Promise<ClavesVapid | null> {
  const delEntorno = cargarClavesVapid(process.env);
  if (delEntorno) return delEntorno;
  if (cache && cache.hasta > Date.now()) return cache.claves;

  const sujeto = process.env.VAPID_SUBJECT?.trim() || SUJETO_POR_DEFECTO;
  try {
    const admin = createAdminClient() as unknown as RpcSinTipos;
    let par = await leerDeVault(admin);
    if (!par) {
      // Primera vez: se genera el par P-256 y se guarda solo si nadie lo guardó antes (la base lo decide con un candado).
      const ecdh = createECDH("prime256v1");
      ecdh.generateKeys();
      const { error } = await admin.rpc("push_vapid_guardar", {
        p_publica: b64urlCodificar(ecdh.getPublicKey()),
        p_privada: b64urlCodificar(ecdh.getPrivateKey()),
      });
      if (error) return null;
      // Se relee: si otra instancia ganó la carrera, vale la suya.
      par = await leerDeVault(admin);
    }
    if (!par) return null;
    const claves = cargarClavesVapid({ VAPID_PUBLIC_KEY: par.publica, VAPID_PRIVATE_KEY: par.privada, VAPID_SUBJECT: sujeto });
    if (claves) cache = { claves, hasta: Date.now() + VIGENCIA_CACHE_MS };
    return claves;
  } catch {
    return null;
  }
}

/** Entorno para `seleccionarAdaptador`: el del proceso más las claves VAPID (de entorno o de Vault). */
export async function entornoConVapid(): Promise<Record<string, string | undefined>> {
  const claves = await obtenerClavesVapid();
  if (!claves) return { ...process.env };
  return {
    ...process.env,
    VAPID_PUBLIC_KEY: claves.publicaB64,
    VAPID_PRIVATE_KEY: b64urlCodificar(claves.privada),
    VAPID_SUBJECT: claves.sujeto,
  };
}

/** Solo la clave PÚBLICA, para entregarla al navegador. */
export async function vapidPublica(): Promise<string | null> {
  return (await obtenerClavesVapid())?.publicaB64 ?? null;
}
