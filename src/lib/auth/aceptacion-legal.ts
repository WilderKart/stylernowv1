import type { createClient } from "@/lib/supabase/server";

/**
 * Registra la aceptación versionada de los textos legales vigentes
 * (06-Security/04_Compliance_Colombia.md, tabla `aceptacion_legal` de la
 * migración 004). Requiere una sesión ya autenticada: RLS
 * `aceptacion_legal_propia` exige `usuario_id = auth.uid()`. Upsert — repetir
 * el login no duplica ni falla si ya se había aceptado esa misma versión.
 *
 * Se llama desde los dos caminos que terminan en una sesión nueva: el código
 * tipeado (`login/actions.ts`) y el magic link (`auth/callback/route.ts`) —
 * antes vivía solo en el primero, así que un login por link nunca quedaba
 * registrado como consentimiento aceptado.
 */
export async function registrarAceptacionLegal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string
) {
  const { data: textos } = await supabase
    .from("texto_legal")
    .select("id, tipo")
    .in("tipo", ["TERMINOS", "POLITICA_DATOS"])
    .order("version", { ascending: false });

  if (!textos?.length) return;

  // La más reciente de cada tipo (ya vienen ordenados por version desc).
  const vigentes = new Map<string, string>();
  for (const t of textos) if (!vigentes.has(t.tipo)) vigentes.set(t.tipo, t.id);

  await supabase
    .from("aceptacion_legal")
    .upsert(
      [...vigentes.values()].map((texto_legal_id) => ({
        usuario_id: usuarioId,
        texto_legal_id,
      })),
      { onConflict: "usuario_id,texto_legal_id", ignoreDuplicates: true }
    );
}
