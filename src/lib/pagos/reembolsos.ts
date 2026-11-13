import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { cuentaDePago, reportarFalloConexion } from "./conexiones";
import { consultarReembolso, ErrorMercadoPago, reembolsar } from "./mercadopago";

/**
 * Worker de reembolsos (migración 116).
 *
 * La base de datos decide QUÉ se devuelve y CUÁNTO (`cancelar_reserva` crea la fila en
 * `reembolso`); este módulo solo la ejecuta contra la pasarela y reporta el resultado.
 * Un reembolso queda REEMBOLSADO únicamente cuando Mercado Pago responde `approved`:
 * enviar la solicitud no basta. La clave de idempotencia hacia la pasarela es el id del
 * reembolso, así que un reintento nunca devuelve dos veces el mismo dinero.
 */

interface FilaReembolso {
  id: string;
  pago_id: string;
  monto: number;
  intentos: number;
}

export interface ResumenReembolsos {
  procesados: number;
  confirmados: number;
  enCurso: number;
  fallidos: number;
}

async function registrar(
  id: string,
  estadoPasarela: string | null,
  idPasarela: string | null,
  error: string | null
) {
  const { data, error: e } = await createAdminClient().rpc("reembolso_registrar_resultado", {
    p_reembolso_id: id,
    // null explícito: la función usa coalesce(p_id_pasarela, …); un texto vacío borraría el id guardado.
    p_estado_pasarela: estadoPasarela as string,
    p_id_pasarela: idPasarela as string,
    p_error: error ?? undefined,
  });
  if (e) throw new Error(`reembolso_registrar_resultado: ${e.message}`);
  return String(data ?? "");
}

function contar(resumen: ResumenReembolsos, destino: string) {
  resumen.procesados += 1;
  if (destino === "REEMBOLSADO") resumen.confirmados += 1;
  else if (destino === "PROCESANDO") resumen.enCurso += 1;
  else resumen.fallidos += 1;
}

async function ejecutar(fila: FilaReembolso, resumen: ResumenReembolsos) {
  const admin = createAdminClient();
  const { data: pago } = await admin
    .from("pago")
    .select("monto, id_transaccion_pasarela")
    .eq("id", fila.pago_id)
    .single();

  if (!pago?.id_transaccion_pasarela) {
    contar(resumen, await registrar(fila.id, null, null, "PAGO_SIN_TRANSACCION_EN_PASARELA"));
    return;
  }

  let conexionId: string | null = null;
  try {
    // Se devuelve desde la cuenta que cobró: la del negocio (cobro directo) o la de StylerNow (histórico).
    const cuenta = await cuentaDePago(fila.pago_id);
    conexionId = cuenta.conexionId;
    const total = Number(fila.monto) >= Number(pago.monto);
    const r = await reembolsar(pago.id_transaccion_pasarela, total ? undefined : Number(fila.monto), fila.id, cuenta.token);
    contar(resumen, await registrar(fila.id, r.status, String(r.id), null));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "ERROR_DESCONOCIDO";
    if (e instanceof ErrorMercadoPago) await reportarFalloConexion(conexionId, e.status, mensaje);
    contar(resumen, await registrar(fila.id, null, null, mensaje));
  }
}

/** Reconsulta los reembolsos que la pasarela dejó en proceso. */
async function reconciliarEnCurso(resumen: ResumenReembolsos, limite: number) {
  const admin = createAdminClient();
  const { data: filas } = await admin
    .from("reembolso")
    .select("id, pago_id, id_reembolso_pasarela")
    .eq("estado", "PROCESANDO")
    .lt("updated_at", new Date(Date.now() - 10 * 60_000).toISOString())
    .limit(limite);

  for (const f of filas ?? []) {
    if (!f.id_reembolso_pasarela) continue;
    const { data: pago } = await admin
      .from("pago")
      .select("id_transaccion_pasarela")
      .eq("id", f.pago_id)
      .single();
    if (!pago?.id_transaccion_pasarela) continue;
    try {
      const cuenta = await cuentaDePago(f.pago_id);
      const r = await consultarReembolso(pago.id_transaccion_pasarela, f.id_reembolso_pasarela, cuenta.token);
      if (r.status === "approved" || r.status === "rejected" || r.status === "cancelled") {
        const error = r.status === "approved" ? null : `PASARELA_${r.status.toUpperCase()}`;
        contar(resumen, await registrar(f.id, r.status, f.id_reembolso_pasarela, error));
      }
    } catch (e) {
      console.error("[reembolsos] no se pudo reconsultar", f.id, e);
    }
  }
}

/**
 * Procesa los reembolsos pendientes. Lo llaman el cron diario y, para que el cliente no
 * espere, cada acción de cancelación justo después de `cancelar_reserva`.
 */
export async function procesarReembolsosPendientes(limite = 20): Promise<ResumenReembolsos> {
  const resumen: ResumenReembolsos = { procesados: 0, confirmados: 0, enCurso: 0, fallidos: 0 };
  const { data, error } = await createAdminClient().rpc("reembolso_tomar_pendientes", { p_limite: limite });
  if (error) throw new Error(`reembolso_tomar_pendientes: ${error.message}`);

  for (const fila of (data ?? []) as FilaReembolso[]) {
    await ejecutar(fila, resumen);
  }
  await reconciliarEnCurso(resumen, limite);
  return resumen;
}

/** Variante que nunca lanza, para llamarla tras una cancelación sin romper la respuesta. */
export async function procesarReembolsosSinFallar(limite = 5) {
  try {
    return await procesarReembolsosPendientes(limite);
  } catch (e) {
    console.error("[reembolsos] el worker falló; el cron diario reintenta", e);
    return null;
  }
}
