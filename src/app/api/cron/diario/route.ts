import { createAdminClient } from "@/lib/supabase/admin";
import type { NextRequest } from "next/server";

/**
 * GET /api/cron/diario — primer cron real del proyecto (Fase 6, Módulo 6.3).
 *
 * Vercel Cron invoca esta ruta con `Authorization: Bearer $CRON_SECRET`
 * automáticamente cuando `CRON_SECRET` está configurado en las variables de
 * entorno del proyecto (https://vercel.com/docs/cron-jobs/manage-cron-jobs) —
 * no requiere ninguna librería adicional, solo verificar ese header acá.
 *
 * Tareas de sistema que hasta esta migración no tenían NINGÚN disparador —
 * existían como RPC pero nadie las llamaba jamás en producción
 * (`expirar_reservas_vencidas` desde la migración 008; `ejecutar_downgrades_programados`,
 * nueva en la migración 049). Futuros módulos con la misma necesidad
 * (rollover de Temporada, bonos agregados de Puntualidad — ver
 * TECH_DEBT_REGISTER.md, Módulo 4 App Staff) agregan su tarea acá en vez de
 * abrir una infraestructura de cron nueva cada vez.
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

  return Response.json({ ok: true, ejecutado_at: new Date().toISOString(), ...resultado });
}
