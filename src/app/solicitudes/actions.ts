"use server";

import { MAX_ARCHIVOS, rutaAdjunto, validarArchivo, type ArchivoValido } from "@/lib/cumplimiento/archivos";
import { enviarASolicitante, procesarNotificacionesCumplimiento } from "@/lib/cumplimiento/notificaciones";
import { generarToken, hashToken, normalizarNumero, TOKEN_RE } from "@/lib/cumplimiento/seguimiento";
import { adminSinTipos, leerConfig, rpcServicio, urlSitio } from "@/lib/cumplimiento/servidor";
import { ipDelLlamador, limitar } from "@/lib/rate-limit";
import { verificarTurnstile } from "@/lib/seguridad/turnstile";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "node:crypto";

/**
 * Radicación y seguimiento PÚBLICOS de solicitudes (PQRS, datos personales, consumidor, incidentes). No exige cuenta.
 * Cada acción es un endpoint POST que cualquiera puede invocar: aquí se decide TODO en el servidor (Turnstile, límites de tasa,
 * validación, archivos por firma binaria). La base vuelve a validar y es quien fija número, plazo, prioridad y estado.
 */
export type ResultadoRadicacion =
  | { ok: true; numero: string; token: string; fechaLimite: string | null; origen: string | null; enlace: string; adjuntosRechazados: number }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const IDEM_RE = /^[0-9a-f-]{36}$/;
const GENERICO = "No pudimos procesar tu solicitud. Revisa los datos e inténtalo de nuevo en unos minutos.";

const ERRORES_RPC: Record<string, string> = {
  TIPO_INVALIDO: "Elige un tipo de solicitud válido.",
  TIPO_NO_PUBLICO: "Ese tipo de solicitud no se radica desde este formulario.",
  ASUNTO_INVALIDO: "El asunto debe tener entre 5 y 160 caracteres.",
  DESCRIPCION_INVALIDA: "Describe tu solicitud (mínimo 10 caracteres, máximo 5.000).",
  SOLICITANTE_INCOMPLETO: "Escribe tu nombre y un correo válido.",
  IDENTIFICACION_REQUERIDA: "Para este tipo de solicitud necesitamos tu tipo y número de documento para verificar que eres el titular de los datos.",
  POLITICA_NO_CONFIRMADA: "Debes confirmar que leíste la Política de Tratamiento de Datos.",
};

function texto(fd: FormData, k: string, max: number): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function describirPlazo(origen: string | null, fecha: string | null): string {
  if (!fecha) return "";
  const f = new Date(fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });
  if (origen === "LEGAL_VERIFICADO") return `El plazo legal para responderte vence el ${f}.`;
  if (origen === "LEGAL_PROVISIONAL") return `Estimamos responderte a más tardar el ${f}. Es un plazo en revisión jurídica, no una garantía legal definitiva.`;
  return `Nuestra meta interna es responderte a más tardar el ${f}. Es un compromiso de servicio, no un plazo legal.`;
}

export async function radicarSolicitud(_prev: ResultadoRadicacion | null, fd: FormData): Promise<ResultadoRadicacion> {
  // 1. Anti-bots: honeypot (campo oculto que una persona nunca llena) + Turnstile (falla cerrado en producción).
  if (texto(fd, "sitio_web", 200)) return { ok: false, error: GENERICO };
  if (!(await verificarTurnstile(fd.get("ts"), "solicitud"))) return { ok: false, error: "No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo." };

  // 2. Campos (minimización: solo lo necesario).
  const tipo = texto(fd, "tipo", 60);
  const email = texto(fd, "email", 254).toLowerCase();
  const nombre = texto(fd, "nombre", 120);
  const telefono = texto(fd, "telefono", 20);
  const idTipo = texto(fd, "id_tipo", 12);
  const idNumero = texto(fd, "id_numero", 20);
  const asunto = texto(fd, "asunto", 160);
  const descripcion = texto(fd, "descripcion", 5000);
  const establecimiento = texto(fd, "establecimiento", 60);
  const reserva = texto(fd, "reserva", 50);
  const idem = texto(fd, "idem", 36);
  if (!EMAIL_RE.test(email)) return { ok: false, error: ERRORES_RPC.SOLICITANTE_INCOMPLETO };
  if (fd.get("acepta_politica") !== "on") return { ok: false, error: ERRORES_RPC.POLITICA_NO_CONFIRMADA };
  if (!IDEM_RE.test(idem)) return { ok: false, error: GENERICO };

  // 3. Límite de tasa por IP y por correo (BD; falla abierto para no impedir un reclamo legítimo si la BD de límites falla).
  const ip = await ipDelLlamador();
  const l1 = await limitar("pqrs_ip", ip, 6, 3600);
  const l2 = await limitar("pqrs_email", email, 4, 86400);
  if (!l1.ok || !l2.ok) return { ok: false, error: "Recibimos varias solicitudes desde tu conexión o correo. Espera un rato antes de enviar otra." };

  // 4. Archivos: se validan TODOS antes de crear el caso.
  const archivos: ArchivoValido[] = [];
  let rechazados = 0;
  const subidos = fd.getAll("archivos").filter((f): f is File => f instanceof File && f.size > 0);
  if (subidos.length > MAX_ARCHIVOS) return { ok: false, error: `Puedes adjuntar máximo ${MAX_ARCHIVOS} archivos.` };
  for (const f of subidos) {
    const v = validarArchivo(f.name, new Uint8Array(await f.arrayBuffer()));
    if (!v.ok) return { ok: false, error: `${f.name}: ${v.error}` };
    archivos.push(v.archivo);
  }

  // 5. Sesión (opcional): si la persona tiene cuenta, el caso queda ligado a ella. El servidor lo decide; el navegador no puede fijarlo.
  let creadoPor: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    creadoPor = data.user?.id ?? null;
  } catch {
    creadoPor = null;
  }

  // 6. Política vigente (la aceptación queda ligada a la versión exacta).
  const tl = await adminSinTipos().from("texto_legal").select("id, version, tipo");
  const politicas = ((tl.data as { id: string; version: number; tipo: string }[] | null) ?? []).filter((t) => t.tipo === "POLITICA_DATOS");
  const politica = politicas.sort((a, b) => b.version - a.version)[0];

  const { token, hash } = generarToken();
  const ref = [establecimiento && `Establecimiento: ${establecimiento}`, reserva && `Reserva: ${reserva}`].filter(Boolean).join(" · ") || null;
  const r = await rpcServicio<{ id: string; numero: string; duplicado: boolean; fecha_limite: string | null; plazo_origen: string | null }>("caso_radicar", {
    p_tipo: tipo,
    p_asunto: asunto,
    p_descripcion: descripcion,
    p_canal: "WEB_PUBLICO",
    p_creado_por: creadoPor,
    p_solicitante: { nombre, email, telefono: telefono || null, id_tipo: idTipo || null, id_numero: idNumero || null },
    p_negocio_id: null,
    p_referencia: ref,
    p_token_hash: hash,
    p_idempotency_key: createHash("sha256").update(`pqrs:${idem}`).digest("hex"),
    p_politica_texto_id: politica?.id ?? null,
  });
  if (r.error || !r.data) {
    const clave = Object.keys(ERRORES_RPC).find((k) => r.error?.message.includes(k));
    if (!clave) console.error("[solicitudes] radicación falló:", r.error?.message);
    return { ok: false, error: clave ? ERRORES_RPC[clave] : GENERICO };
  }
  const caso = r.data;
  // Reenvío del mismo formulario (doble clic): el caso ya existe y su token original ya se entregó; no se emite otro.
  if (caso.duplicado) return { ok: false, error: `Tu solicitud ya fue radicada con el número ${caso.numero}. Revisa el correo de confirmación.` };

  // 7. Adjuntos (bucket privado; si alguno falla, el caso ya existe y se avisa).
  const storage = adminSinTipos().storage;
  for (const a of archivos) {
    const ruta = rutaAdjunto(caso.id, a.ext);
    const up = await storage.from("casos-adjuntos").upload(ruta, a.buffer, { contentType: a.mime, upsert: false });
    if (up.error) {
      rechazados++;
      continue;
    }
    const reg = await rpcServicio("caso_registrar_adjunto", {
      p_ticket: caso.id, p_path: ruta, p_nombre: a.nombre, p_mime: a.mime, p_bytes: a.buffer.byteLength, p_sha256: a.sha256,
      p_actor_tipo: creadoPor ? "USUARIO" : "SOLICITANTE", p_actor: creadoPor,
    });
    if (reg.error) {
      rechazados++;
      await storage.from("casos-adjuntos").remove([ruta]);
    }
  }

  // 8. Acuse al solicitante (con su enlace de seguimiento) y alerta inmediata al equipo.
  const cfg = await leerConfig();
  const enlace = `${urlSitio()}/solicitudes/seguimiento#${caso.numero}.${token}`;
  const cuerpo =
    `Hola ${nombre.split(" ")[0]},\n\nRecibimos tu solicitud y la radicamos con el número ${caso.numero}.\n\n` +
    `${describirPlazo(caso.plazo_origen, caso.fecha_limite)}\n\n` +
    `Consulta el estado, responde o complementa tu caso aquí (guarda este enlace, es personal):\n${enlace}\n\n` +
    `Si tienes dudas, escríbenos a ${cfg.correo_atencion || "equipo@stylernow.com"} citando el número de radicación.\n\n` +
    `Este mensaje confirma la recepción de tu solicitud; no es la respuesta de fondo.\nStylerNow, producto operado por TAWILSTACK S.A.S.`;
  await enviarASolicitante(caso.id, email, "ACUSE_SOLICITANTE", `Recibimos tu solicitud ${caso.numero}`, cuerpo).catch(() => false);
  await procesarNotificacionesCumplimiento(10).catch((e) => console.error("[solicitudes] alerta inmediata falló:", e));

  return { ok: true, numero: caso.numero, token, fechaLimite: caso.fecha_limite, origen: caso.plazo_origen, enlace, adjuntosRechazados: rechazados };
}

// ── Seguimiento ────────────────────────────────────────────────────────────
export type CasoPublico = {
  numero: string;
  asunto: string;
  estado: string;
  tipo: string | null;
  recibido_at: string;
  fecha_limite: string | null;
  plazo_origen: string | null;
  respondido_at: string | null;
  resuelto_at: string | null;
  cerrado_at: string | null;
  prorroga: boolean;
  esperando_solicitante: boolean;
  mensajes: { actor: string; mensaje: string; tipo: string; at: string }[];
  historial: { evento: string; estado: string | null; at: string }[];
};

const NO_ENCONTRADO = "No encontramos un caso con ese número y ese enlace. Revisa que los hayas copiado completos.";

export async function consultarCaso(numeroEntrada: string, token: string): Promise<{ ok: true; caso: CasoPublico } | { ok: false; error: string }> {
  const numero = normalizarNumero(numeroEntrada);
  if (!numero || !TOKEN_RE.test(token)) return { ok: false, error: NO_ENCONTRADO };
  // Anti-enumeración y anti-fuerza-bruta: por IP y por número; la respuesta de fallo es siempre la misma.
  const ip = await ipDelLlamador();
  const a = await limitar("pqrs_consulta_ip", ip, 40, 600);
  const b = await limitar("pqrs_consulta_num", numero, 15, 3600);
  if (!a.ok || !b.ok) return { ok: false, error: "Demasiadas consultas. Intenta de nuevo en unos minutos." };
  const r = await rpcServicio<CasoPublico>("caso_consultar_publico", { p_numero: numero, p_token_hash: hashToken(token) });
  if (r.error || !r.data) return { ok: false, error: NO_ENCONTRADO };
  return { ok: true, caso: r.data };
}

export async function responderCaso(numeroEntrada: string, token: string, mensaje: string): Promise<{ ok: boolean; error?: string }> {
  const numero = normalizarNumero(numeroEntrada);
  const m = (mensaje ?? "").trim();
  if (!numero || !TOKEN_RE.test(token)) return { ok: false, error: NO_ENCONTRADO };
  if (m.length < 2 || m.length > 5000) return { ok: false, error: "Escribe un mensaje de entre 2 y 5.000 caracteres." };
  const ip = await ipDelLlamador();
  const a = await limitar("pqrs_responder_ip", ip, 20, 3600);
  const b = await limitar("pqrs_responder_num", numero, 10, 3600);
  if (!a.ok || !b.ok) return { ok: false, error: "Demasiados mensajes. Intenta de nuevo más tarde." };
  const r = await rpcServicio<boolean>("caso_responder_publico", { p_numero: numero, p_token_hash: hashToken(token), p_mensaje: m });
  if (r.error?.message.includes("CASO_CERRADO")) return { ok: false, error: "Este caso ya está cerrado. Si necesitas algo más, radica una solicitud nueva." };
  if (r.error || r.data !== true) return { ok: false, error: NO_ENCONTRADO };
  return { ok: true };
}

/** «Perdí mi enlace»: siempre responde lo mismo (no revela si el caso o el correo existen). */
export async function reenviarEnlace(numeroEntrada: string, email: string, tokenTs: string | null): Promise<{ ok: boolean; error?: string }> {
  const respuesta = { ok: true as const };
  const numero = normalizarNumero(numeroEntrada);
  const correo = (email ?? "").trim().toLowerCase();
  if (!(await verificarTurnstile(tokenTs, "seguimiento"))) return { ok: false, error: "No pudimos verificar que eres una persona. Recarga la página." };
  if (!numero || !EMAIL_RE.test(correo)) return respuesta;
  const ip = await ipDelLlamador();
  const a = await limitar("pqrs_enlace_ip", ip, 5, 3600);
  const b = await limitar("pqrs_enlace_num", numero, 3, 86400);
  if (!a.ok || !b.ok) return respuesta;
  const { token, hash } = generarToken();
  const r = await rpcServicio<string>("caso_rotar_token", { p_numero: numero, p_email: correo, p_token_hash: hash });
  if (r.data) {
    await enviarASolicitante(
      r.data, correo, "ENLACE_SEGUIMIENTO", `Nuevo enlace de seguimiento ${numero}`,
      `Generamos un enlace nuevo para consultar tu caso ${numero} (el anterior dejó de funcionar):
${urlSitio()}/solicitudes/seguimiento#${numero}.${token}

Si no lo pediste tú, ignora este mensaje y escríbenos.`,
    ).catch(() => false);
  }
  return respuesta;
}
