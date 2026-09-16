import "server-only";

/**
 * Capa de abstracción de proveedores de IA (ADR-011 + extensión pedida por
 * el fundador el 2026-09-16): StylerNow nunca depende de un solo proveedor
 * de LLM. Cada llamada intenta los proveedores configurados EN ORDEN — si
 * uno falla (caída, cuota agotada, error de red), automáticamente
 * reintenta con el siguiente, sin que el llamador tenga que saberlo.
 *
 * Proveedores soportados hoy, ambos con API compatible OpenAI
 * (`/chat/completions`):
 * 1. OpenRouter (principal) — `OPENROUTER_API_KEY`/`OPENROUTER_BASE_URL`/`OPENROUTER_MODEL`.
 * 2. Nemotron/NVIDIA vía tokenrouter.com (respaldo) — `NEMOTRON_API_KEY`/
 *    `NEMOTRON_BASE_URL`/`NEMOTRON_MODEL`. NOTA: verificado el 2026-09-16
 *    que la clave es válida y el modelo real es
 *    `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, pero la cuenta
 *    tiene $0.00 de crédito ("insufficient_user_quota") — el respaldo
 *    queda completamente conectado y listo, pero no tendrá capacidad real
 *    hasta que se recargue esa cuenta en tokenrouter.com.
 *
 * Ninguna clave vive en código ni en ningún archivo versionado — solo en
 * variables de entorno. Si un proveedor no tiene su API key configurada,
 * simplemente se omite de la lista (nunca rompe la app por faltar el
 * respaldo).
 */

interface ProveedorConfig {
  nombre: string;
  apiKey: string;
  baseUrl: string;
  modelo: string;
}

function proveedoresDisponibles(): ProveedorConfig[] {
  const lista: ProveedorConfig[] = [];

  if (process.env.OPENROUTER_API_KEY) {
    lista.push({
      nombre: "OpenRouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/$/, ""),
      modelo: process.env.OPENROUTER_MODEL ?? "openrouter/free",
    });
  }

  if (process.env.NEMOTRON_API_KEY) {
    lista.push({
      nombre: "Nemotron",
      apiKey: process.env.NEMOTRON_API_KEY,
      baseUrl: (process.env.NEMOTRON_BASE_URL ?? "https://api.tokenrouter.com/v1").replace(/\/$/, ""),
      modelo: process.env.NEMOTRON_MODEL ?? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    });
  }

  if (lista.length === 0) {
    throw new Error("Ningún proveedor de IA configurado (falta OPENROUTER_API_KEY y/o NEMOTRON_API_KEY en el entorno).");
  }

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
 * Llamada de chat con failover automático — intenta cada proveedor
 * configurado en orden hasta que uno responda; solo falla si TODOS fallan.
 * `nivel` etiqueta la llamada para logs/costos (Nivel 1 económica / Nivel 2
 * premium, `AI_Credit_System.md`) — ambos niveles usan hoy el mismo modelo
 * de cada proveedor, hasta que haya presupuesto para diferenciarlos.
 */
export async function chat(mensajes: MensajeChat[], opciones: { nivel?: 1 | 2; maxTokens?: number } = {}): Promise<RespuestaChat> {
  const proveedores = proveedoresDisponibles();
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
 * Pide una respuesta JSON estricta (insights estructurados, ver
 * `09-CRM-Intelligence/*` y Módulo 12 de ADR-011) — reintenta una vez con
 * un recordatorio explícito si el modelo devuelve texto no parseable,
 * dentro del mismo intento de failover de `chat()`.
 */
export async function chatJSON<T>(mensajes: MensajeChat[], opciones: { nivel?: 1 | 2; maxTokens?: number } = {}): Promise<T> {
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
