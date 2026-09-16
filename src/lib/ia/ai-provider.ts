import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Capa de abstracción de proveedores de IA + Cost Optimizer (ADR-011 y
 * ADR-013): StylerNow nunca depende de un solo proveedor de LLM, y nunca
 * hardcodea el orden de preferencia en TypeScript — vive en
 * `ai_modelo_config` (AI OS, migración 064), editable por SuperSU sin
 * tocar código.
 *
 * Orden oficial del Cost Optimizer (ADR-013): Ollama local → OpenRouter
 * económico → Gemini → modelo premium → fallback. Hoy solo OpenRouter y
 * Nemotron (mapeado al proveedor NEMOTRON) tienen credenciales reales
 * configuradas — Gemini (sin API key todavía) queda registrado en
 * `ai_modelo_config` con `activo = false`, listo para activarse el día
 * que exista la credencial, sin tocar código (ver docs/PENDING_DECISIONS.md).
 *
 * Ollama (ADR-014, Fase G): nunca es una dependencia de producción — su
 * rol es exclusivamente de desarrollo interno (documentación, pruebas,
 * clasificación, tareas internas), corriendo en la máquina del
 * desarrollador. `OLLAMA_BASE_URL` está ausente por diseño en Vercel/
 * producción; si un desarrollador la define en su propio `.env.local`,
 * el Cost Optimizer la usa igual que cualquier otro proveedor activo —
 * nunca debe depender de ella ningún flujo que sirva tráfico real de un
 * Negocio.
 */

interface ProveedorConfig {
  nombre: string;
  apiKey: string;
  baseUrl: string;
  modelo: string;
}

/** Único lugar donde se resuelve una credencial de entorno para un proveedor. */
function credencialProveedor(proveedor: string): { apiKey: string; baseUrl: string } | null {
  switch (proveedor) {
    case "OPENROUTER":
      if (!process.env.OPENROUTER_API_KEY) return null;
      return { apiKey: process.env.OPENROUTER_API_KEY, baseUrl: (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/$/, "") };
    case "NEMOTRON":
      if (!process.env.NEMOTRON_API_KEY) return null;
      return { apiKey: process.env.NEMOTRON_API_KEY, baseUrl: (process.env.NEMOTRON_BASE_URL ?? "https://api.tokenrouter.com/v1").replace(/\/$/, "") };
    case "GEMINI":
      if (!process.env.GEMINI_API_KEY) return null;
      return { apiKey: process.env.GEMINI_API_KEY, baseUrl: (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "") };
    case "OLLAMA":
      if (!process.env.OLLAMA_BASE_URL) return null;
      return { apiKey: "ollama", baseUrl: process.env.OLLAMA_BASE_URL.replace(/\/$/, "") };
    default:
      return null;
  }
}

/**
 * Cost Optimizer: lee `ai_modelo_config` (orden de preferencia real,
 * editable por SuperSU) y arma la lista de proveedores REALMENTE
 * disponibles hoy (activos + con credencial presente en el entorno).
 * Si no se pasa un cliente de Supabase, o la tabla no responde, cae al
 * orden mínimo hardcodeado (OpenRouter → Nemotron) para que la app nunca
 * quede sin IA por un problema de lectura de configuración.
 */
async function proveedoresDisponibles(supabase?: SupabaseClient): Promise<ProveedorConfig[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("ai_modelo_config")
      .select("nombre, proveedor, modelo_id, orden_preferencia, activo")
      .eq("activo", true)
      .order("orden_preferencia", { ascending: true });

    if (!error && data) {
      const lista: ProveedorConfig[] = [];
      for (const fila of data) {
        const cred = credencialProveedor(fila.proveedor);
        if (!cred) continue; // sin credencial en el entorno — se omite, nunca rompe la app.
        lista.push({ nombre: fila.nombre, apiKey: cred.apiKey, baseUrl: cred.baseUrl, modelo: fila.modelo_id });
      }
      if (lista.length > 0) return lista;
    }
  }

  // Fallback mínimo si no hay Supabase disponible o la tabla está vacía.
  const lista: ProveedorConfig[] = [];
  const or = credencialProveedor("OPENROUTER");
  if (or) lista.push({ nombre: "OpenRouter", ...or, modelo: process.env.OPENROUTER_MODEL ?? "openrouter/free" });
  const nemo = credencialProveedor("NEMOTRON");
  if (nemo) lista.push({ nombre: "Nemotron", ...nemo, modelo: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free" });
  if (lista.length === 0) throw new Error("Ningún proveedor de IA configurado (falta OPENROUTER_API_KEY y/o NEMOTRON_API_KEY en el entorno).");
  return lista;
}

export interface MensajeChat {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RespuestaChat {
  contenido: string;
  modelo: string;
  proveedor: string;
  costoUsd: number;
}

async function llamarProveedor(p: ProveedorConfig, mensajes: MensajeChat[], maxTokens: number): Promise<RespuestaChat> {
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${p.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: p.modelo,
      messages: mensajes,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`${p.nombre} ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const cuerpo = (await res.json()) as {
    model: string;
    choices?: { message?: { content?: string } }[];
    usage?: { cost?: number };
  };

  const contenido = cuerpo.choices?.[0]?.message?.content?.trim();
  if (!contenido) throw new Error(`${p.nombre} no devolvió contenido.`);

  return { contenido, modelo: cuerpo.model, proveedor: p.nombre, costoUsd: cuerpo.usage?.cost ?? 0 };
}

/**
 * Llamada de chat con Cost Optimizer + failover automático — intenta cada
 * proveedor activo en el orden de `ai_modelo_config` hasta que uno
 * responda; solo falla si TODOS fallan. `supabase` es opcional pero se
 * recomienda siempre pasarlo (server_role) para que el orden real de
 * `ai_modelo_config` gobierne, en vez del fallback hardcodeado.
 */
export async function chat(mensajes: MensajeChat[], opciones: { nivel?: 1 | 2; maxTokens?: number; supabase?: SupabaseClient } = {}): Promise<RespuestaChat> {
  const proveedores = await proveedoresDisponibles(opciones.supabase);
  const errores: string[] = [];

  for (const p of proveedores) {
    try {
      return await llamarProveedor(p, mensajes, opciones.maxTokens ?? 500);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      errores.push(mensaje);
      console.error(`[ai-provider] ${p.nombre} falló, probando el siguiente proveedor —`, mensaje);
    }
  }

  throw new Error(`Todos los proveedores de IA fallaron: ${errores.join(" | ")}`);
}

/**
 * Pide una respuesta JSON estricta (insights estructurados) — reintenta
 * una vez con un recordatorio explícito si el modelo devuelve texto no
 * parseable, dentro del mismo intento de failover de `chat()`.
 */
export async function chatJSON<T>(mensajes: MensajeChat[], opciones: { nivel?: 1 | 2; maxTokens?: number; supabase?: SupabaseClient } = {}): Promise<T> {
  const intentar = async (mensajesIntento: MensajeChat[]) => {
    const r = await chat(mensajesIntento, opciones);
    const match = r.contenido.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("Respuesta sin JSON detectable.");
    return JSON.parse(match[0]) as T;
  };

  try {
    return await intentar(mensajes);
  } catch {
    return await intentar([
      ...mensajes,
      { role: "user", content: "Respondé ÚNICAMENTE con el JSON solicitado, sin texto adicional, sin markdown." },
    ]);
  }
}
