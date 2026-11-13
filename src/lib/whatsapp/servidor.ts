import "server-only";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";

/** Las RPC de la migracion 120 aun no estan en src/types/database.ts (se regenera al aplicarla). */
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

export async function llamarRpcWhatsApp<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nombre: string,
  args?: object
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await (supabase as unknown as RpcSinTipos).rpc(nombre, args ?? {});
  return { data: (data as T) ?? null, error: error ? error.message : null };
}

/**
 * Sesion del dueno del negocio. El negocio se deriva de auth.uid() en el servidor (nunca del navegador);
 * las RPC vuelven a validar la pertenencia con is_barberia_de().
 */
export async function sesionDuenoWhatsApp() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const contexto = await resolverContexto();
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId || contexto.userId !== user.id) throw new Error("NO_AUTORIZADO");
  return { supabase, negocioId: contexto.negocioId };
}

/** Sesion de SuperSU para acciones de /admin/whatsapp (la RPC vuelve a exigir is_supersu()). */
export async function sesionSuperSUWhatsApp() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
  if (!perfil?.es_supersu) throw new Error("NO_AUTORIZADO");
  return { supabase };
}
