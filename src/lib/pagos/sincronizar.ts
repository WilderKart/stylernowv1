import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buscarPagoPorReferencia, obtenerPago, reembolsar, type PagoPasarela } from "./mercadopago";
import { cuentaDePago, tokenDeConexion } from "./conexiones";
import { procesarReembolsosSinFallar } from "./reembolsos";

/**
 * Reconciliación de un cobro contra la pasarela.
 *
 * Es el único camino por el que un `pago` cambia de estado, y lo comparten el webhook
 * (05-API/06_Webhooks.md) y el retorno del Cliente desde el checkout. En ambos casos el
 * estado se lee de la API de Mercado Pago, nunca del cuerpo del webhook ni de la URL de
 * retorno — así un tercero no puede confirmar una Reserva falsificando una notificación.
 *
 * La idempotencia vive en `aplicar_evento_pago`: reenviar el mismo evento N veces
 * produce exactamente un efecto de negocio.
 */

export type ResultadoSincronizacion =
  | { estado: "APROBADO"; reservaId: string | null }
  | { estado: "RECHAZADO"; reservaId: string | null }
  | { estado: "PENDIENTE" }
  | { estado: "SIN_CAMBIOS"; motivo: string }
  | { estado: "REEMBOLSADO"; motivo: string };

async function aplicar(pagoId: string, pagoPasarela: PagoPasarela): Promise<ResultadoSincronizacion> {
  const admin = createAdminClient();

  if (pagoPasarela.estado === "PENDIENTE") return { estado: "PENDIENTE" };

  // Defensa en profundidad: nunca se aprueba un cobro cuyo monto en la pasarela no coincide con el que
  // nosotros fijamos al crear la preferencia (el monto sale siempre de `pago.monto`, nunca del cliente).
  // Tolerancia de 1 unidad por el redondeo de `unit_price`. Se deja constancia para revisión manual.
  if (pagoPasarela.estado === "APROBADO") {
    const { data: esperado } = await admin.from("pago").select("monto, estado").eq("id", pagoId).maybeSingle();
    if (esperado && esperado.estado !== "APROBADO" && Math.abs(Math.round(Number(esperado.monto)) - pagoPasarela.monto) > 1) {
      await admin.from("evento_auditoria").insert({
        entidad_tipo: "pago",
        entidad_id: pagoId,
        accion: "PAGO_MONTO_NO_COINCIDE",
        actor_tipo: "SISTEMA",
        payload_despues: { esperado: Number(esperado.monto), recibido: pagoPasarela.monto, id_transaccion: pagoPasarela.id },
      });
      return { estado: "SIN_CAMBIOS", motivo: "MONTO_NO_COINCIDE" };
    }
  }

  const { data, error } = await admin.rpc("aplicar_evento_pago", {
    p_pago_id: pagoId,
    p_id_transaccion: pagoPasarela.id,
    p_estado: pagoPasarela.estado,
    p_payload: {
      id: pagoPasarela.id,
      status: pagoPasarela.estadoCrudo,
      status_detail: pagoPasarela.detalle,
      payment_method_id: pagoPasarela.metodo,
      transaction_amount: pagoPasarela.monto,
    },
  });

  if (error) throw new Error(`aplicar_evento_pago: ${error.message}`);

  const r = (data ?? {}) as {
    procesado?: boolean;
    requiere_reembolso?: boolean;
    motivo?: string;
    reserva_id?: string | null;
  };

  if (!r.procesado) return { estado: "SIN_CAMBIOS", motivo: r.motivo ?? "SIN_EFECTO" };

  // 03-Business-Rules/03_Payment_Rules.md: pago que confirma después de la expiración
  // de la Reserva se reembolsa al 100%, sin intervención de soporte.
  if (r.requiere_reembolso) {
    // Se encola (idempotente por pago) y lo ejecuta el worker: el `pago` y el reverso del
    // wallet solo cambian cuando la pasarela confirma la devolución (migración 116).
    const { data: pago } = await admin.from("pago").select("monto").eq("id", pagoId).single();
    const { error: e } = await admin.rpc("_reembolso_crear", {
      p_pago_id: pagoId,
      p_monto: Number(pago?.monto ?? pagoPasarela.monto),
      p_pct: 100,
      p_motivo: "CANCELACION_NEGOCIO",
      p_origen: "PAGO_TARDIO",
      p_actor_tipo: "SISTEMA",
    });
    if (e) throw new Error(`_reembolso_crear: ${e.message}`);
    await procesarReembolsosSinFallar();

    return { estado: "REEMBOLSADO", motivo: r.motivo ?? "RESERVA_EXPIRADA" };
  }

  return pagoPasarela.estado === "APROBADO"
    ? { estado: "APROBADO", reservaId: r.reserva_id ?? null }
    : { estado: "RECHAZADO", reservaId: r.reserva_id ?? null };
}

/** Camino del retorno del checkout y del polling de la pantalla de pago. */
export async function sincronizarPago(pagoId: string): Promise<ResultadoSincronizacion> {
  // Se consulta con el token de la cuenta en la que se cobró (negocio o plataforma).
  const cuenta = await cuentaDePago(pagoId);
  const pasarela = await buscarPagoPorReferencia(pagoId, cuenta.token);
  if (!pasarela) return { estado: "PENDIENTE" };
  return aplicar(pagoId, pasarela);
}

/**
 * Camino del webhook: llega el id de la transacción, no el de nuestro `pago`.
 * `conexionId` es el que pusimos en la `notification_url` del cobro (cuenta del negocio);
 * sin él, la transacción es de la cuenta de StylerNow. Aunque alguien lo alterara, la
 * transacción solo se encuentra con el token de la cuenta que realmente la cobró, y
 * además se exige que el `pago` esté ligado a esa misma cuenta.
 */
export async function sincronizarDesdeTransaccion(
  idTransaccion: string,
  conexionId: string | null = null
): Promise<ResultadoSincronizacion> {
  const token = conexionId ? await tokenDeConexion(conexionId) : undefined;
  const pasarela = await obtenerPago(idTransaccion, token);
  const pagoId = pasarela.referenciaExterna;

  const admin = createAdminClient();

  // Webhook cuyo `external_reference` no corresponde a ningún `pago` conocido:
  // se registra como HUERFANO para revisión y se devuelve el dinero si se cobró
  // (05-API/06_Webhooks.md, caso límite — nunca se descarta en silencio).
  const { data: pagoFila } =
    pagoId && /^[0-9a-f-]{36}$/i.test(pagoId)
      ? await (admin as unknown as {
          from: (t: string) => {
            select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } };
          };
        })
          .from("pago")
          .select("id, conexion_pago_id")
          .eq("id", pagoId)
          .maybeSingle()
      : { data: null };
  const pago = pagoFila as { id: string; conexion_pago_id: string | null } | null;

  if (pago && (pago.conexion_pago_id ?? null) !== (conexionId ?? null)) {
    await admin.from("evento_auditoria").insert({
      entidad_tipo: "pago",
      entidad_id: pago.id,
      accion: "WEBHOOK_CUENTA_NO_COINCIDE",
      actor_tipo: "SISTEMA",
      payload_despues: { id_transaccion: pasarela.id, conexion_notificada: conexionId },
    });
    return { estado: "SIN_CAMBIOS", motivo: "CUENTA_NO_COINCIDE" };
  }

  if (!pago) {
    await admin.from("evento_auditoria").insert({
      entidad_tipo: "pago",
      entidad_id: null,
      accion: "WEBHOOK_HUERFANO",
      actor_tipo: "SISTEMA",
      payload_despues: {
        id_transaccion: pasarela.id,
        external_reference: pagoId,
        status: pasarela.estadoCrudo,
        monto: pasarela.monto,
      },
    });

    // Se devuelve desde la misma cuenta que lo cobró. Clave estable: el reintento no duplica.
    if (pasarela.estado === "APROBADO") await reembolsar(pasarela.id, undefined, `huerfano-${pasarela.id}`, token);
    return { estado: "REEMBOLSADO", motivo: "HUERFANO" };
  }

  return aplicar(pago.id, pasarela);
}
