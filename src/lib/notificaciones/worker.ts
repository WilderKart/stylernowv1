import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { seleccionarAdaptador, type AdaptadorCanal } from "./adaptadores";
import { armarMensaje, type FilaOutbox } from "./mensaje";

/**
 * Worker del outbox (migración 124). Lo invoca /api/cron/diario con service_role.
 *  1. Genera lo programado (recordatorios de cita, prueba por terminar).
 *  2. Entrega el canal PANEL dentro de la base.
 *  3. Si un canal está habilitado, devuelve a la cola lo marcado CANAL_NO_HABILITADO en las últimas 24 h.
 *  4. Toma un lote EMAIL/PUSH (FOR UPDATE SKIP LOCKED), envía con el adaptador y registra el resultado.
 *     ENVIADO solo con id del proveedor; sin credenciales → CANAL_NO_HABILITADO.
 * Nunca registra cuerpos ni direcciones en logs.
 */
type RpcSinTipos = {
  rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
};


export interface ResumenOutbox {
  programadas: unknown;
  panel_entregadas: number | { error: string };
  reencoladas: number;
  tomadas: number;
  por_estado: Record<string, number>;
  errores: string[];
}

export async function procesarOutbox(limite = 100): Promise<ResumenOutbox> {
  const admin = createAdminClient() as unknown as RpcSinTipos;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") ? process.env.NEXT_PUBLIC_SITE_URL : "https://stylernow.com";
  const lim = Math.min(Math.max(Math.trunc(limite) || 100, 1), 200);
  const resumen: ResumenOutbox = { programadas: null, panel_entregadas: 0, reencoladas: 0, tomadas: 0, por_estado: {}, errores: [] };

  const prog = await admin.rpc("notif_generar_programadas", { p_ventana_horas: 24 });
  resumen.programadas = prog.error ? { error: prog.error.message } : prog.data;

  const panel = await admin.rpc("notif_entregar_panel", { p_limite: lim * 2 });
  resumen.panel_entregadas = panel.error ? { error: panel.error.message } : Number(panel.data) || 0;

  const adaptadores: Record<"EMAIL" | "PUSH", AdaptadorCanal> = {
    EMAIL: seleccionarAdaptador("EMAIL"),
    PUSH: seleccionarAdaptador("PUSH"),
  };
  for (const canal of ["EMAIL", "PUSH"] as const) {
    if (!adaptadores[canal].habilitado) continue;
    const r = await admin.rpc("notif_outbox_reencolar_no_habilitados", { p_canal: canal, p_max_horas: 24 });
    if (r.error) resumen.errores.push(`reencolar_${canal}`);
    else resumen.reencoladas += Number(r.data) || 0;
  }

  const lote = await admin.rpc("notif_outbox_tomar", { p_limite: lim, p_canales: ["EMAIL", "PUSH"] });
  if (lote.error) {
    resumen.errores.push("tomar");
    return resumen;
  }
  const filas = (Array.isArray(lote.data) ? lote.data : []) as FilaOutbox[];
  resumen.tomadas = filas.length;

  for (const fila of filas) {
    let ok = false;
    let idExterno: string | null = null;
    let codigo: string | null = null;
    let reintentable = false;
    try {
      const adaptador = fila.canal === "EMAIL" || fila.canal === "PUSH" ? adaptadores[fila.canal] : null;
      const msg = armarMensaje(fila, base);
      if (!adaptador || !adaptador.habilitado) {
        codigo = "CANAL_NO_HABILITADO";
      } else if (!msg) {
        codigo = "PLANTILLA_NO_ENCONTRADA";
      } else {
        const r = await adaptador.enviar(msg);
        for (const endpoint of r.expirados ?? []) {
          await admin.rpc("notif_push_eliminar_endpoint", { p_endpoint: endpoint });
        }
        if (r.ok) {
          ok = true;
          idExterno = r.idExterno;
        } else {
          codigo = r.codigo;
          reintentable = r.reintentable;
        }
      }
    } catch {
      codigo = "ERROR_INESPERADO";
      reintentable = true;
    }
    const reg = await admin.rpc("notif_outbox_registrar", {
      p_id: fila.id,
      p_ok: ok,
      p_id_externo: idExterno,
      p_codigo: codigo,
      p_reintentable: reintentable,
    });
    // Si falla el registro, la fila queda PROCESANDO y el lease vencido la devuelve a la cola (no se pierde ni se duplica en Resend).
    const estado = reg.error ? "ERROR_REGISTRO" : String(reg.data);
    resumen.por_estado[estado] = (resumen.por_estado[estado] ?? 0) + 1;
  }
  return resumen;
}
