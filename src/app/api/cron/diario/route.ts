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
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secreto || auth !== `Bearer ${secreto}`) {
    return new Response("no autorizado", { status: 401 });
  }

  const admin = createAdminClient();
  const resultado: Record<string, unknown> = {};

  const { data: reservasExpiradas, error: e1 } = await admin.rpc("expirar_reservas_vencidas");
  resultado.reservas_expiradas = e1 ? { error: e1.message } : reservasExpiradas;

  const { data: downgrades, error: e2 } = await admin.rpc("ejecutar_downgrades_programados");
  resultado.downgrades = e2 ? { error: e2.message } : downgrades;

  const { data: creditosIa, error: e3 } = await admin.rpc("otorgar_creditos_plan_mensual");
  resultado.creditos_ia_otorgados = e3 ? { error: e3.message } : creditosIa;

  const { data: roiSnapshot, error: e4 } = await admin.rpc("generar_roi_snapshot_mensual");
  resultado.roi_ia_snapshot = e4 ? { error: e4.message } : roiSnapshot;

  try {
    resultado.suscripciones = await ejecutarCicloSuscripciones();
  } catch (e) {
    resultado.suscripciones = { error: e instanceof Error ? e.message : "error inesperado" };
  }

  try {
    const { data, error } = await (admin as unknown as RpcSinTipos).rpc("limpiar_limite_tasa");
    resultado.limite_tasa_limpiado = error ? { error: error.message } : data;
  } catch (e) {
    resultado.limite_tasa_limpiado = { error: e instanceof Error ? e.message : "error inesperado" };
  }

  // --- Cliente (C01 / C15): tareas defensivas; un fallo aquí no afecta a las anteriores. ---
  try {
    const { data, error } = await admin.rpc("generar_recordatorios_cita", { p_ventana_horas: 24 });
    resultado.recordatorios_cita = error ? { error: error.message } : data;
  } catch (e) {
    resultado.recordatorios_cita = { error: e instanceof Error ? e.message : "error inesperado" };
  }

  try {
    resultado.eliminacion_cuentas = await procesarEliminacionesCuenta(admin);
  } catch (e) {
    resultado.eliminacion_cuentas = { error: e instanceof Error ? e.message : "error inesperado" };
  }

  return Response.json({ ok: true, ejecutado_at: new Date().toISOString(), ...resultado });
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
