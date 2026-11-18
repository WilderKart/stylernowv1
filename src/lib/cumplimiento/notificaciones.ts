import "server-only";
import { adaptadorResend } from "@/lib/notificaciones/adaptadores";
import { adaptadorSms } from "./adaptador-sms";
import { adminSinTipos, leerConfig, rpcServicio, urlSitio } from "./servidor";

/**
 * Procesa la cola `cumplimiento_notificacion` (migración 152). Reutiliza el adaptador de correo existente (Resend); no hay una segunda
 * infraestructura de correo. SMS pasa por su adaptador, hoy sin proveedor: nunca se marca «enviado» sin identificador del proveedor.
 * El CRM no necesita envío: su «entrega» es la fila persistida (la ve el SuperAdmin en el Centro).
 */
type Fila = {
  id: string;
  ticket_id: string;
  plantilla: string;
  canal: "EMAIL" | "SMS";
  destinatario: string | null;
  datos: Record<string, unknown>;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderizar(plantilla: string, datos: Record<string, unknown>, html = false): string {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = datos[k];
    const t = v === null || v === undefined ? "" : String(v);
    return html ? esc(t) : t;
  });
}

export function restanteLegible(horas: unknown): string {
  const h = typeof horas === "number" ? horas : Number(horas);
  if (horas === null || horas === undefined || !Number.isFinite(h)) return "sin plazo";
  if (h < 0) return `vencido hace ${Math.abs(Math.round(h))} h`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} días`;
}

type ResultadoEnvio = { ok: true; idExterno: string } | { ok: false; codigo: string; reintentable: boolean };

export async function procesarNotificacionesCumplimiento(limite = 25): Promise<{ tomadas: number; enviadas: number; fallidas: number; no_habilitadas: number }> {
  const res = { tomadas: 0, enviadas: 0, fallidas: 0, no_habilitadas: 0 };
  const lote = await rpcServicio<Fila[]>("cumplimiento_tomar_lote", { p_limite: limite });
  if (lote.error || !lote.data?.length) return res;
  const cfg = await leerConfig();
  const pl = await adminSinTipos().from("cumplimiento_plantilla").select("codigo, canal, asunto, cuerpo, activa");
  const plantillas = (pl.data as { codigo: string; canal: string; asunto: string; cuerpo: string; activa: boolean }[] | null) ?? [];
  const correo = adaptadorResend({ ...process.env, NOTIFICACIONES_EMAIL_REMITENTE: cfg.correo_remitente });
  const sms = adaptadorSms({ habilitado: cfg.sms_habilitado, proveedor: cfg.sms_proveedor, credencialesRef: cfg.sms_credenciales_ref }, process.env);
  const base = urlSitio();

  for (const n of lote.data) {
    res.tomadas++;
    const p = plantillas.find((x) => x.codigo === n.plantilla && x.canal === n.canal && x.activa);
    if (!p || !n.destinatario) {
      await rpcServicio("cumplimiento_marcar", { p_id: n.id, p_resultado: "FALLIDO", p_error: !p ? "PLANTILLA_NO_ENCONTRADA" : "SIN_DESTINATARIO" });
      res.fallidas++;
      continue;
    }
    const ruta = String(n.datos.ruta ?? "/admin/centro-cumplimiento");
    const datos = { ...n.datos, restante: restanteLegible(n.datos.restante_horas), enlace: `${base}${ruta}` };
    let r: ResultadoEnvio;
    try {
      if (n.canal === "EMAIL") {
        r = await correo.enviar({
          id: n.id,
          canal: "EMAIL",
          idioma: "es",
          asunto: renderizar(p.asunto, datos),
          texto: renderizar(p.cuerpo, datos),
          html: `<div style="font-family:system-ui,sans-serif;white-space:pre-line">${renderizar(p.cuerpo, datos, true)}</div>`,
          ruta,
          email: n.destinatario,
        });
      } else {
        r = await sms.enviar(n.destinatario, renderizar(p.cuerpo, datos), `cumpl-${n.id}`);
      }
    } catch (e) {
      r = { ok: false, codigo: e instanceof Error ? e.message.slice(0, 60) : "ERROR", reintentable: true };
    }
    if (r.ok) {
      await rpcServicio("cumplimiento_marcar", { p_id: n.id, p_resultado: "ENVIADO", p_id_externo: r.idExterno });
      res.enviadas++;
    } else if (r.codigo === "CANAL_NO_HABILITADO") {
      await rpcServicio("cumplimiento_marcar", { p_id: n.id, p_resultado: "CANAL_NO_HABILITADO", p_error: r.codigo });
      res.no_habilitadas++;
    } else {
      await rpcServicio("cumplimiento_marcar", { p_id: n.id, p_resultado: r.reintentable ? "REINTENTABLE" : "FALLIDO", p_error: r.codigo });
      res.fallidas++;
    }
  }
  return res;
}

/**
 * Correo al solicitante (acuse, respuesta, prórroga, requerimiento). Va fuera de la cola porque algunos llevan el token de seguimiento,
 * que no debe guardarse. Deja constancia del resultado (ENVIADO solo con id del proveedor; FALLIDO si no), que además queda en evidencias.
 */
export async function enviarASolicitante(ticketId: string, email: string, plantilla: string, asunto: string, texto: string): Promise<boolean> {
  const cfg = await leerConfig();
  const correo = adaptadorResend({ ...process.env, NOTIFICACIONES_EMAIL_REMITENTE: cfg.correo_remitente });
  let r: ResultadoEnvio;
  try {
    r = await correo.enviar({
      id: `sol-${ticketId}-${plantilla}-${Date.now()}`,
      canal: "EMAIL",
      idioma: "es",
      asunto,
      texto,
      html: `<div style="font-family:system-ui,sans-serif;white-space:pre-line">${esc(texto)}</div>`,
      ruta: "/",
      email,
    });
  } catch (e) {
    r = { ok: false, codigo: e instanceof Error ? e.message.slice(0, 60) : "ERROR", reintentable: true };
  }
  await rpcServicio("caso_registrar_envio", {
    p_ticket: ticketId,
    p_plantilla: plantilla,
    p_destinatario: email,
    p_resultado: r.ok ? "ENVIADO" : r.codigo === "CANAL_NO_HABILITADO" ? "CANAL_NO_HABILITADO" : "FALLIDO",
    p_id_externo: r.ok ? r.idExterno : null,
    p_error: r.ok ? null : r.codigo,
  });
  return r.ok;
}
