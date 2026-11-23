import { procesarNotificacionesCumplimiento } from "@/lib/cumplimiento/notificaciones";
import { procesarOutbox } from "@/lib/notificaciones/worker";
import { procesarReembolsosPendientes } from "@/lib/pagos/reembolsos";
import { reconciliarPagosPendientes } from "@/lib/pagos/sincronizar";
import { ejecutarCicloSuscripciones } from "@/lib/planes/ciclo-suscripciones";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/diario — primer cron real del proyecto (Fase 6, Módulo 6.3).
 *
 * Vercel Cron invoca esta ruta con `Authorization: Bearer $CRON_SECRET`
 * automáticamente cuando `CRON_SECRET` está configurado en las variables de
 * entorno del proyecto (https://vercel.com/docs/cron-jobs/manage-cron-jobs) —
 * no requiere ninguna librería adicional, solo verificar ese header aquí.
 *
 * Tareas de sistema que hasta esta migración no tenían NINGÚN disparador —
 * existían como RPC pero nadie las llamaba jamás en producción
 * (`expirar_reservas_vencidas` desde la migración 008; `ejecutar_downgrades_programados`,
 * nueva en la migración 049; `otorgar_creditos_plan_mensual` — AI OS/ADR-013,
 * migración 067; `generar_roi_snapshot_mensual` — ROI real de IA/ADR-014
 * Fase C, migración 079 — todas revocadas de `authenticated` a propósito
 * para que solo este cron con `service_role` las ejecute). Correr
 * `generar_roi_snapshot_mensual()` todos los días es seguro e idempotente
 * (upsert por período: `on conflict (negocio_id, periodo_inicio, periodo_fin)`).
 * Futuros módulos con la misma necesidad (rollover de Temporada, bonos
 * agregados de Puntualidad — ver TECH_DEBT_REGISTER.md, Módulo 4 App Staff)
 * agregan su tarea aquí en vez de abrir una infraestructura de cron nueva
 * cada vez.
 */
function conteoBacklog(valor: unknown): Record<string, number> | undefined {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secreto || auth !== `Bearer ${secreto}`) {
    return new Response("no autorizado", { status: 401 });
  }

  const inicioCron = Date.now();
  const admin = createAdminClient();
  const resultado: Record<string, unknown> = {};
  const metricas: Array<{ tarea: string; duracion_ms: number; ok: boolean; backlog?: Record<string, number> }> = [];

  async function ejecutarTarea<T>(tarea: string, fn: () => Promise<T>): Promise<T | { error: string }> {
    const t0 = Date.now();
    try {
      const valor = await fn();
      metricas.push({ tarea, duracion_ms: Date.now() - t0, ok: true, backlog: conteoBacklog(valor) });
      return valor;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error inesperado";
      metricas.push({ tarea, duracion_ms: Date.now() - t0, ok: false });
      return { error: msg };
    }
  }

  resultado.reservas_expiradas = await ejecutarTarea("reservas_expiradas", async () => {
    const { data, error } = await admin.rpc("expirar_reservas_vencidas");
    if (error) throw new Error(error.message);
    return data;
  });

  resultado.downgrades = await ejecutarTarea("downgrades", async () => {
    const { data, error } = await admin.rpc("ejecutar_downgrades_programados");
    if (error) throw new Error(error.message);
    return data;
  });

  resultado.creditos_ia_otorgados = await ejecutarTarea("creditos_ia_otorgados", async () => {
    const { data, error } = await admin.rpc("otorgar_creditos_plan_mensual");
    if (error) throw new Error(error.message);
    return data;
  });

  resultado.roi_ia_snapshot = await ejecutarTarea("roi_ia_snapshot", async () => {
    const { data, error } = await admin.rpc("generar_roi_snapshot_mensual");
    if (error) throw new Error(error.message);
    return data;
  });

  resultado.cumplimiento_sla = await ejecutarTarea("cumplimiento_sla", async () => {
    const { data, error } = await (admin as unknown as RpcSinTipos).rpc("cumplimiento_evaluar_sla");
    if (error) throw new Error(error.message);
    return data;
  });
  resultado.cumplimiento_envios = await ejecutarTarea("cumplimiento_envios", async () => procesarNotificacionesCumplimiento(50));
  resultado.suscripciones = await ejecutarTarea("suscripciones", async () => ejecutarCicloSuscripciones());
  resultado.limite_tasa_limpiado = await ejecutarTarea("limite_tasa_limpiado", async () => {
    const { data, error } = await (admin as unknown as RpcSinTipos).rpc("limpiar_limite_tasa");
    if (error) throw new Error(error.message);
    return data;
  });
  resultado.retencion_1581 = await ejecutarTarea("retencion_1581", async () => {
    const { data, error } = await (admin as unknown as RpcSinTipos).rpc("purgar_retencion_1581");
    if (error) throw new Error(error.message);
    return data;
  });
  resultado.recordatorios_cita = await ejecutarTarea("recordatorios_cita", async () => {
    const { data, error } = await admin.rpc("generar_recordatorios_cita", { p_ventana_horas: 24 });
    if (error) throw new Error(error.message);
    return data;
  });
  resultado.eliminacion_cuentas = await ejecutarTarea("eliminacion_cuentas", async () => procesarEliminacionesCuenta(admin));
  resultado.comisiones_programadas = await ejecutarTarea("comisiones_programadas", async () => {
    const { data, error } = await (admin as unknown as RpcSinTipos).rpc("aplicar_comisiones_programadas");
    if (error) throw new Error(error.message);
    return data;
  });
  resultado.whatsapp_lotes_plan = await ejecutarTarea("whatsapp_lotes_plan", async () => {
    const { data, error } = await (admin as unknown as RpcSinTipos).rpc("whatsapp_otorgar_lotes_plan_mes");
    if (error) throw new Error(error.message);
    return data;
  });
  resultado.conciliacion_pagos = await ejecutarTarea("conciliacion_pagos", async () => reconciliarPagosPendientes(30));
  resultado.adicionales = await ejecutarTarea("adicionales", async () => {
    const { data, error } = await (admin as unknown as RpcSinTipos).rpc("adicional_mantenimiento_srv", {});
    if (error) throw new Error(error.message);
    return data;
  });
  resultado.reembolsos = await ejecutarTarea("reembolsos", async () => procesarReembolsosPendientes(50));
  resultado.notificaciones = await ejecutarTarea("notificaciones", async () => procesarOutbox(200));
  resultado.registros_abandonados = await ejecutarTarea("registros_abandonados", async () => {
    const { data, error } = await (admin as unknown as RpcSinTipos).rpc("cuentas_registro_abandonado", { p_horas: 24, p_limite: 50 });
    if (error) throw new Error(error.message);
    let eliminadas = 0;
    for (const f of (data ?? []) as { usuario_id: string }[]) {
      const { error: e } = await admin.auth.admin.deleteUser(f.usuario_id);
      if (!e) eliminadas += 1;
    }
    return { eliminadas };
  });

  const duracion_ms = Date.now() - inicioCron;
  const fallidas = metricas.filter((m) => !m.ok).length;
  console.info(JSON.stringify({ evento: "cron.diario", duracion_ms, tareas: metricas.length, fallidas, metricas }));

  return Response.json({ ok: true, ejecutado_at: new Date().toISOString(), duracion_ms, metricas, ...resultado });
}

type AdminClient = ReturnType<typeof createAdminClient>;
type RpcSinTipos = {
  rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Eliminación de cuentas de cliente tras el periodo de gracia (migraciones 099/100):
 * 1) RPC `procesar_eliminaciones_cuenta` anonimiza datos del cliente en la BD;
 * 2) la cuenta de acceso se inhabilita con la Admin API de Auth (soft delete: sin login, email liberado);
 * 3) se purgan del storage las fotos My Look encoladas.
 * Si la migración 100 aún no está aplicada, el RPC falla y se reporta sin romper el cron.
 */
async function procesarEliminacionesCuenta(admin: AdminClient) {
  const out: Record<string, unknown> = {};
  const sinTipos = admin as unknown as RpcSinTipos;

  const { data: proc, error: eProc } = await sinTipos.rpc("procesar_eliminaciones_cuenta", { p_limite: 20 });
  out.anonimizacion = eProc ? { error: eProc.message } : proc;

  const { data: pendientes } = await admin
    .from("solicitud_cuenta")
    .select("id, usuario_id")
    .eq("tipo", "ELIMINACION")
    .eq("estado", "EJECUTADA")
    .eq("auth_cerrada", false)
    .limit(20);
  let cerradas = 0;
  for (const s of pendientes ?? []) {
    const { error } = await admin.auth.admin.deleteUser(s.usuario_id, true);
    if (!error) {
      await sinTipos.rpc("marcar_auth_cerrada", { p_solicitud_id: s.id });
      cerradas += 1;
    }
  }
  out.auth_cerradas = cerradas;

  const { data: archivos } = await admin.from("purga_storage_pendiente").select("id, bucket, ruta").limit(100);
  let purgados = 0;
  for (const a of archivos ?? []) {
    const { error } = await admin.storage.from(a.bucket).remove([a.ruta]);
    if (!error) {
      await admin.from("purga_storage_pendiente").delete().eq("id", a.id);
      purgados += 1;
    }
  }
  out.archivos_purgados = purgados;
  return out;
}
