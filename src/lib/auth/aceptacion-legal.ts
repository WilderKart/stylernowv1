import type { createClient } from "@/lib/supabase/server";

export interface TextoLegalPendiente {
  id: string;
  tipo: string;
  version: number;
  contenido: string;
}

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
 *
 * 02-UX/10_Super_Admin.md exige "re-aceptación forzada" cuando una versión
 * nueva se publica con `cambio_material = true` — antes esta función
 * aceptaba TODO en silencio en cada login sin importar el flag, lo que
 * dejaba la re-aceptación forzada sin ningún efecto real. Ahora una versión
 * material pendiente NO se acepta automáticamente: se devuelve para que el
 * caller redirija a `/legal/aceptar` antes de continuar. Los cambios no
 * materiales (redacción, typos) se siguen aceptando en silencio, como antes.
 */
export async function registrarAceptacionLegal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string
): Promise<{ pendientesMateriales: TextoLegalPendiente[] }> {
  const { data: textos } = await supabase
    .from("texto_legal")
    .select("id, tipo, version, contenido, cambio_material")
    .in("tipo", ["TERMINOS", "POLITICA_DATOS"])
    .order("version", { ascending: false });

  if (!textos?.length) return { pendientesMateriales: [] };

  // La más reciente de cada tipo (ya vienen ordenados por version desc).
  const vigentes = new Map<string, (typeof textos)[number]>();
  for (const t of textos) if (!vigentes.has(t.tipo)) vigentes.set(t.tipo, t);

  const { data: aceptadas } = await supabase
    .from("aceptacion_legal")
    .select("texto_legal_id")
    .eq("usuario_id", usuarioId)
    .in("texto_legal_id", [...vigentes.values()].map((t) => t.id));
  const idsAceptados = new Set((aceptadas ?? []).map((a) => a.texto_legal_id));

  const pendientesMateriales: TextoLegalPendiente[] = [];
  const paraAceptarEnSilencio: string[] = [];

  for (const t of vigentes.values()) {
    if (idsAceptados.has(t.id)) continue;
    if (t.cambio_material) {
      pendientesMateriales.push({ id: t.id, tipo: t.tipo, version: t.version, contenido: t.contenido });
    } else {
      paraAceptarEnSilencio.push(t.id);
    }
  }

  if (paraAceptarEnSilencio.length) {
    await supabase
      .from("aceptacion_legal")
      .upsert(
        paraAceptarEnSilencio.map((texto_legal_id) => ({ usuario_id: usuarioId, texto_legal_id })),
        { onConflict: "usuario_id,texto_legal_id", ignoreDuplicates: true }
      );
  }

  return { pendientesMateriales };
}

/**
 * Variante de solo lectura de `registrarAceptacionLegal` — nunca escribe.
 * La usa `/legal/aceptar` (Server Component) para mostrar qué falta aceptar
 * sin mutar datos durante un render; la aceptación real ocurre en la Server
 * Action `aceptarPendientes`.
 */
export async function obtenerPendientesLegales(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string
): Promise<TextoLegalPendiente[]> {
  const { data: textos } = await supabase
    .from("texto_legal")
    .select("id, tipo, version, contenido, cambio_material")
    .in("tipo", ["TERMINOS", "POLITICA_DATOS"])
    .order("version", { ascending: false });
  if (!textos?.length) return [];

  // La versión vigente de cada tipo es la de mayor número, sin importar si es
  // material o no — si la vigente NO es material, ese tipo nunca bloquea,
  // aunque una versión material anterior en su historial nunca se haya
  // aceptado explícitamente (quedó cubierta por la versión siguiente).
  const vigentes = new Map<string, (typeof textos)[number]>();
  for (const t of textos) if (!vigentes.has(t.tipo)) vigentes.set(t.tipo, t);

  const materiales = [...vigentes.values()].filter((t) => t.cambio_material);
  if (!materiales.length) return [];

  const { data: aceptadas } = await supabase
    .from("aceptacion_legal")
    .select("texto_legal_id")
    .eq("usuario_id", usuarioId)
    .in("texto_legal_id", materiales.map((t) => t.id));
  const idsAceptados = new Set((aceptadas ?? []).map((a) => a.texto_legal_id));

  return materiales
    .filter((t) => !idsAceptados.has(t.id))
    .map((t) => ({ id: t.id, tipo: t.tipo, version: t.version, contenido: t.contenido }));
}

/** Acepta explícitamente los textos legales pendientes (usado por `/legal/aceptar`). */
export async function aceptarTextosLegales(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string,
  textoLegalIds: string[]
) {
  if (!textoLegalIds.length) return;
  await supabase
    .from("aceptacion_legal")
    .upsert(
      textoLegalIds.map((texto_legal_id) => ({ usuario_id: usuarioId, texto_legal_id })),
      { onConflict: "usuario_id,texto_legal_id", ignoreDuplicates: true }
    );
}
