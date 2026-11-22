import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;
/** Origen de la aceptación (columna `aceptacion_legal.origen`, migración 145). */
export type OrigenAceptacion = "registro" | "perfil" | "legal_aceptar" | "ingreso";

/**
 * Única vía de escritura (migración 145): la función `registrar_aceptacion_legal` toma la identidad
 * de la sesión y la hora del servidor, y solo admite versiones VIGENTES. El navegador ya no puede
 * insertar, cambiar ni borrar filas de `aceptacion_legal`.
 */
async function registrarEnServidor(supabase: Supa, ids: string[], origen: OrigenAceptacion, tipo: "EXPRESA" | "TACITA") {
  if (!ids.length) return;
  const { error } = await (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ error: { message: string } | null }> }).rpc(
    "registrar_aceptacion_legal",
    { p_texto_ids: ids, p_origen: origen, p_tipo: tipo }
  );
  if (error) console.error("[aceptacion-legal] no se pudo registrar", origen, tipo, error.message);
}

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

  // Regla vigente (no se cambia aquí): los cambios NO materiales se registran al ingresar sin acción
  // de la persona. La evidencia los marca como TÁCITOS para no aparentar una aceptación expresa.
  if (paraAceptarEnSilencio.length) await registrarEnServidor(supabase, paraAceptarEnSilencio, "ingreso", "TACITA");

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

/** Ids de la versión vigente de Términos y Política de Datos (la de mayor número de cada tipo). */
export async function idsTextosVigentes(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  const { data: textos } = await supabase
    .from("texto_legal")
    .select("id, tipo, version")
    .in("tipo", ["TERMINOS", "POLITICA_DATOS"])
    .order("version", { ascending: false });
  const vigentes = new Map<string, string>();
  for (const t of textos ?? []) if (!vigentes.has(t.tipo)) vigentes.set(t.tipo, t.id);
  return [...vigentes.values()];
}

/** ¿Le falta aceptar alguna versión vigente? (cuenta nueva por Google: aún no marcó la casilla). */
export async function faltaAceptarVigentes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string
): Promise<boolean> {
  const ids = await idsTextosVigentes(supabase);
  if (!ids.length) return false;
  const { data } = await supabase.from("aceptacion_legal").select("texto_legal_id").eq("usuario_id", usuarioId).in("texto_legal_id", ids);
  return (data?.length ?? 0) < ids.length;
}

/**
 * Registro con contraseña: desde la migración 145 la aceptación se guarda EN EL SERVIDOR en el mismo
 * instante del registro (`registrar_aceptacion_legal_registro`, con la hora del servidor), no al
 * verificar el correo ni con la hora de los metadatos de Auth (que el usuario puede editar).
 * Esta función solo dice si la cuenta vino del registro con casilla (para enrutar) y, para cuentas
 * creadas ANTES de la 145 que aún no tienen la fila, la registra ahora con la hora real de servidor.
 */
export async function registrarAceptacionDeRegistro(
  supabase: Supa,
  usuario: { id: string; user_metadata?: Record<string, unknown> | null }
): Promise<boolean> {
  const meta = usuario.user_metadata ?? {};
  const ids = Array.isArray(meta.acepta_legal_ids) ? meta.acepta_legal_ids.filter((x): x is string => typeof x === "string") : [];
  if (!ids.length) return false;
  const vigentes = new Set(await idsTextosVigentes(supabase));
  const validos = ids.filter((id) => vigentes.has(id));
  if (validos.length) await registrarEnServidor(supabase, validos, "registro", "EXPRESA");
  return true;
}

/** Aceptación EXPRESA de textos vigentes (casilla marcada o botón «Aceptar»), con su origen. */
export async function aceptarTextosLegales(supabase: Supa, _usuarioId: string, textoLegalIds: string[], origen: OrigenAceptacion = "legal_aceptar") {
  await registrarEnServidor(supabase, textoLegalIds, origen, "EXPRESA");
}
