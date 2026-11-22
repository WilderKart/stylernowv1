"use server";

import { autorizarSuperSU } from "@/lib/auth/autorizar-supersu";
import { enviarASolicitante, procesarNotificacionesCumplimiento } from "@/lib/cumplimiento/notificaciones";
import { adminSinTipos } from "@/lib/cumplimiento/servidor";
import { revalidatePath } from "next/cache";

/**
 * Acciones del Centro de Cumplimiento y PQRS. Cada una es un endpoint POST: la autorización (SuperSU, sesión real) se decide aquí
 * y la base la vuelve a exigir dentro de cada RPC (`_caso_exigir_supersu`). Nada de lo que manda el navegador decide permisos.
 */
type Rpc = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };
export type Res<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

const ERRORES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso de SuperSU.",
  CASO_NO_ENCONTRADO: "No encontramos ese caso.",
  TRANSICION_INVALIDA: "Ese cambio de estado no está permitido desde el estado actual.",
  USE_ACCION_ESPECIFICA: "Ese estado se cambia con su acción (responder, resolver, cerrar…).",
  RESPUESTA_SUSTANTIVA_REQUERIDA: "Antes de resolver hay que enviar una respuesta de fondo al solicitante (no basta el acuse).",
  RESULTADO_REQUERIDO: "Describe el resultado o la decisión (mínimo 10 caracteres).",
  CASO_NO_RESUELTO: "Solo se puede cerrar un caso resuelto (o trasladado / desistido).",
  NOTA_CIERRE_REQUERIDA: "Un caso crítico exige una nota de cierre (mínimo 20 caracteres).",
  CASO_CERRADO: "El caso ya está cerrado.",
  MOTIVO_REQUERIDO: "Escribe un motivo suficiente.",
  PRORROGA_YA_APLICADA: "Este caso ya tuvo su ampliación de plazo.",
  SIN_PRORROGA_DEFINIDA: "Este tipo de caso no tiene una ampliación de plazo definida.",
  PLAZO_VENCIDO_NO_PRORROGABLE: "El plazo ya venció: la ampliación debió informarse antes del vencimiento.",
  CASO_NO_ABIERTO: "El caso ya no está abierto.",
  RESPONSABLE_INVALIDO: "Solo una cuenta SuperSU puede ser responsable.",
  MENSAJE_INVALIDO: "El mensaje es demasiado corto o demasiado largo.",
  DATOS_INCOMPLETOS: "Completa el destino y el motivo del traslado.",
  SMS_SIN_PROVEEDOR: "No se puede habilitar el SMS: falta proveedor y referencia de credenciales.",
  EMAIL_INVALIDO: "Revisa los correos: alguno no es válido.",
  TELEFONO_INVALIDO: "El celular debe incluir el indicativo, por ejemplo +57 3001234567.",
  VALOR_INVALIDO: "El valor no es válido.",
  REMITENTE_INVALIDO: "El remitente no es válido.",
  DEMASIADOS_ADJUNTOS: "El caso ya tiene el máximo de adjuntos.",
};
const traducir = (m: string) => ERRORES[Object.keys(ERRORES).find((k) => m.includes(k)) ?? ""] ?? "No pudimos completar la operación.";

async function guardia() {
  const g = await autorizarSuperSU();
  if (!g.ok) throw new Error(g.error);
  return { rpc: g.supabase as unknown as Rpc, userId: g.userId };
}
async function llamar<T>(nombre: string, args?: object): Promise<Res<T>> {
  try {
    const { rpc } = await guardia();
    const { data, error } = await rpc.rpc(nombre, args);
    if (error) return { ok: false, error: traducir(error.message) };
    return { ok: true, data: data as T } as Res<T>;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Lecturas ───────────────────────────────────────────────────────────────
export type Dashboard = Record<string, number | Record<string, number> | { habilitado: boolean; pendientes_por_deshabilitado: number }>;
export type FilaCaso = {
  id: string; numero: string; asunto: string; tipo_codigo: string; tipo_nombre: string; categoria: string; canal: string; prioridad: string;
  estado_caso: string; estado_respuesta: string; responsable_id: string | null; responsable: string | null; recibido_at: string;
  fecha_limite: string | null; plazo_origen: string | null; vencido: boolean; horas_restantes: number | null; proxima_accion: string | null; total: number;
};

export async function cargarDashboard() {
  // Ejecuta el motor de SLA al abrir (idempotente): cubre el cron diario con una evaluación al momento de consultar.
  await llamar("cumplimiento_evaluar_sla");
  return llamar<Dashboard>("caso_dashboard");
}
export async function listarCasos(bandeja: string, filtros: Record<string, string>, offset = 0) {
  const limpio = Object.fromEntries(Object.entries(filtros).filter(([, v]) => typeof v === "string" && v.length > 0 && v.length < 80));
  return llamar<FilaCaso[]>("caso_listar", { p_bandeja: bandeja, p_filtros: limpio, p_limite: 50, p_offset: offset });
}
export async function detalleCaso(id: string) {
  return llamar<Record<string, unknown> | null>("caso_detalle", { p_ticket: id });
}
export async function alertasCrm() {
  return llamar<{ id: string; ticket_id: string; numero: string; regla: string; prioridad: string; created_at: string; leida: boolean }[]>("cumplimiento_alertas_crm", { p_limite: 20 });
}
export async function evidenciasCaso(id: string) {
  return llamar<{ secuencia: number; ocurrido_at: string; finalidad: string; accion: string; rol: string; hash: string; hash_anterior: string | null; tiene_texto: boolean }[]>("caso_evidencias", { p_ticket: id });
}

// ── Acciones sobre un caso ─────────────────────────────────────────────────
export type AccionCaso =
  | { tipo: "asignar"; responsable: string | null; supervisor?: string | null }
  | { tipo: "estado"; estado: "EN_REVISION" | "ASIGNADO" | "EN_GESTION" | "ESPERANDO_TERCERO"; motivo?: string }
  | { tipo: "responder"; mensaje: string; sustantiva: boolean }
  | { tipo: "subsanacion"; mensaje: string }
  | { tipo: "prorroga"; motivo: string }
  | { tipo: "trasladar"; destino: string; motivo: string }
  | { tipo: "escalar"; motivo: string }
  | { tipo: "resolver"; resultado: string }
  | { tipo: "cerrar"; nota?: string }
  | { tipo: "reabrir"; motivo: string }
  | { tipo: "nota"; nota: string };

const UUID = /^[0-9a-f-]{36}$/i;

/** Datos mínimos para escribirle al solicitante (si dejó correo). */
async function contacto(id: string): Promise<{ email: string; numero: string } | null> {
  const r = await llamar<{ ticket: { numero_radicacion: string }; solicitante: { email: string } | null } | null>("caso_detalle", { p_ticket: id });
  if (!r.ok || !r.data?.solicitante?.email) return null;
  return { email: r.data.solicitante.email, numero: r.data.ticket.numero_radicacion };
}

export async function ejecutarAccion(id: string, a: AccionCaso): Promise<Res<{ correo?: "enviado" | "fallido" | "sin_correo" }>> {
  if (!UUID.test(id)) return { ok: false, error: "Caso no válido." };
  let r: Res<unknown>;
  switch (a.tipo) {
    case "asignar":
      if (a.responsable !== null && !UUID.test(a.responsable)) return { ok: false, error: "Responsable no válido." };
      r = await llamar("caso_asignar", { p_ticket: id, p_responsable: a.responsable, p_supervisor: a.supervisor && UUID.test(a.supervisor) ? a.supervisor : null });
      break;
    case "estado":
      r = await llamar("caso_cambiar_estado", { p_ticket: id, p_nuevo: a.estado, p_motivo: a.motivo ?? null });
      break;
    case "responder":
      r = await llamar("caso_responder", { p_ticket: id, p_mensaje: a.mensaje, p_sustantiva: a.sustantiva });
      break;
    case "subsanacion":
      r = await llamar("caso_solicitar_subsanacion", { p_ticket: id, p_mensaje: a.mensaje });
      break;
    case "prorroga":
      r = await llamar("caso_extender_plazo", { p_ticket: id, p_motivo: a.motivo });
      break;
    case "trasladar":
      r = await llamar("caso_trasladar", { p_ticket: id, p_destino: a.destino, p_motivo: a.motivo });
      break;
    case "escalar":
      r = await llamar("caso_escalar", { p_ticket: id, p_motivo: a.motivo });
      break;
    case "resolver":
      r = await llamar("caso_resolver", { p_ticket: id, p_resultado: a.resultado });
      break;
    case "cerrar":
      r = await llamar("caso_cerrar", { p_ticket: id, p_nota: a.nota ?? null });
      break;
    case "reabrir":
      r = await llamar("caso_reabrir", { p_ticket: id, p_motivo: a.motivo });
      break;
    case "nota":
      r = await llamar("caso_nota_interna", { p_ticket: id, p_nota: a.nota });
      break;
    default:
      return { ok: false, error: "Acción no válida." };
  }
  if (!r.ok) return r;

  // Comunicaciones al solicitante (solo si la acción lo amerita y dejó correo).
  let correo: "enviado" | "fallido" | "sin_correo" | undefined;
  const textoParaSolicitante =
    a.tipo === "responder" && a.sustantiva ? { plantilla: "RESPUESTA_SOLICITANTE", texto: a.mensaje }
    : a.tipo === "responder" ? { plantilla: "MENSAJE_SOLICITANTE", texto: a.mensaje }
    : a.tipo === "subsanacion" ? { plantilla: "REQUERIMIENTO_SOLICITANTE", texto: `${a.mensaje}\n\nSi en dos meses no recibimos la información, entenderemos que desistes de la solicitud.` }
    : a.tipo === "prorroga" ? { plantilla: "PRORROGA_SOLICITANTE", texto: `Te informamos que necesitamos ampliar el plazo para atender tu solicitud.\nMotivo: ${a.motivo}\nPuedes ver la nueva fecha en tu enlace de seguimiento.` }
    : a.tipo === "trasladar" ? { plantilla: "TRASLADO_SOLICITANTE", texto: `Tu solicitud corresponde a ${a.destino} y fue trasladada.\nMotivo: ${a.motivo}` }
    : null;
  if (textoParaSolicitante) {
    const c = await contacto(id);
    if (!c) correo = "sin_correo";
    else {
      const ok = await enviarASolicitante(
        id, c.email, textoParaSolicitante.plantilla, `Tu solicitud ${c.numero}`,
        `${textoParaSolicitante.texto}\n\nNúmero de radicación: ${c.numero}\nStylerNow, producto operado por TAWILSTACK S.A.S.`,
      ).catch(() => false);
      correo = ok ? "enviado" : "fallido";
    }
  }
  // Escalamientos y cambios críticos generan alertas: se despachan de inmediato.
  await procesarNotificacionesCumplimiento(10).catch(() => undefined);
  revalidatePath("/admin/centro-cumplimiento");
  return { ok: true, data: { correo } } as Res<{ correo?: "enviado" | "fallido" | "sin_correo" }>;
}

// ── Adjuntos (enlace firmado de 60 s, solo descarga) ───────────────────────
export async function urlAdjunto(adjuntoId: string): Promise<Res<string>> {
  if (!UUID.test(adjuntoId)) return { ok: false, error: "Adjunto no válido." };
  const r = await llamar<string>("caso_autorizar_descarga", { p_adjunto: adjuntoId });   // autoriza y deja auditoría
  if (!r.ok) return r;
  const { data, error } = await adminSinTipos().storage.from("casos-adjuntos").createSignedUrl(r.data, 60, { download: true });
  if (error || !data?.signedUrl) return { ok: false, error: "No pudimos generar el enlace de descarga." };
  return { ok: true, data: data.signedUrl } as Res<string>;
}

// ── Configuración (destinatarios, SMS, reglas) ─────────────────────────────
export type ConfigVista = {
  alertas_email_destinatarios: string[]; correo_remitente: string; correo_atencion: string; correo_operativo: string;
  sms_numero: string; sms_habilitado: boolean; sms_proveedor: string | null; sms_credenciales_ref: string | null;
  sla_reglas: { porcentajes: number[]; horas_antes: number[]; sin_asignar_minutos: number; sin_movimiento_dias: number; repetir_vencido_horas: number };
};
export async function leerConfiguracion(): Promise<Res<ConfigVista>> {
  try {
    const { rpc } = await guardia();
    // Lectura directa con la sesión del SuperSU (RLS: solo SuperSU).
    const sb = rpc as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: { clave: string; valor: unknown }[] | null; error: { message: string } | null }> } };
    const { data, error } = await sb.from("cumplimiento_config").select("clave, valor");
    if (error) return { ok: false, error: traducir(error.message) };
    const o = Object.fromEntries((data ?? []).map((x) => [x.clave, x.valor]));
    return { ok: true, data: o as unknown as ConfigVista } as Res<ConfigVista>;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
const CLAVES = new Set(["alertas_email_destinatarios", "correo_remitente", "correo_atencion", "correo_operativo", "sms_numero", "sms_habilitado", "sms_proveedor", "sms_credenciales_ref", "sla_reglas"]);
export async function guardarConfiguracion(clave: string, valor: unknown): Promise<Res> {
  if (!CLAVES.has(clave)) return { ok: false, error: "Clave desconocida." };
  const r = await llamar("cumplimiento_config_set", { p_clave: clave, p_valor: valor });
  if (!r.ok) return r;
  revalidatePath("/admin/centro-cumplimiento");
  return { ok: true } as Res;
}
export async function marcarAlertasLeidas(): Promise<Res> {
  const r = await llamar("cumplimiento_marcar_leidas", {});
  return r.ok ? ({ ok: true } as Res) : r;
}
