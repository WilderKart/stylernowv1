import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createAdminClient } from "@/lib/supabase/admin";
import { POLITICA_PASSWORD } from "@/lib/auth/password-policy";

const scryptAsync = promisify(scrypt);

/**
 * `password_history` guarda SOLO hashes (nunca la contraseña) y existe
 * exclusivamente para comparar "no reutilizar las últimas N" — Supabase/
 * GoTrue no expone el hash real que usa para autenticar, así que este es un
 * hash independiente, calculado acá, que nunca se usa para loguear a nadie.
 * Tabla con RLS deny-by-default (migración 081) — se accede solo vía
 * `createAdminClient()`, igual que `evento_auditoria`.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivado = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${derivado.toString("hex")}`;
}

async function coincideHash(password: string, hashGuardado: string): Promise<boolean> {
  const [saltHex, hashHex] = hashGuardado.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const esperado = Buffer.from(hashHex, "hex");
  const derivado = (await scryptAsync(password, salt, 64)) as Buffer;
  return derivado.length === esperado.length && timingSafeEqual(derivado, esperado);
}

export async function passwordFueUsadaAntes(userId: string, password: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("password_history")
    .select("hash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(POLITICA_PASSWORD.noReutilizarUltimas);

  for (const fila of data ?? []) {
    if (await coincideHash(password, fila.hash)) return true;
  }
  return false;
}

export async function guardarEnHistorial(userId: string, password: string): Promise<void> {
  const admin = createAdminClient();
  const hash = await hashPassword(password);
  await admin.from("password_history").insert({ user_id: userId, hash });
}
