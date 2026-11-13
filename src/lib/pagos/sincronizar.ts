import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buscarPagoPorReferencia, obtenerPago, reembolsar, type PagoPasarela } from "./mercadopago";
import { conexionesDeCuenta, cuentaDePago, cuentaVendedorDeConexion, tokenDeConexion } from "./conexiones";
import { liveModeCoincide } from "./entorno";
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
  | { estado: "REEMBOLSADO"; motivo: string }
  | { estado: "EN_DISPUTA"; reservaId: string | null }
  | { estado: "REQUIERE_REVISION"; motivo: string };

/** Datos de trazabilidad para el registro del webhook (sin datos del pagador ni secretos). */
export interface TrazaSincronizacion {
  pagoId: string | null;
  negocioId: string | null;
  estadoProveedor: string | null;
  liveMode: boolean | null;
}

/** Estados del proveedor posteriores a la aprobación: no los aplica `aplicar_evento_pago`. */
const ESTADOS_DISPUTA = new Set(["charged_back", "in_mediation"]);
const ESTADOS_REEMBOLSO = new Set(["refunded"]);

/**
 * Devuelve un código de problema si el pago informado no corresponde a este entorno o a la cuenta
 * del negocio dueño del cobro; null si todo coincide.
 */
async function verificarOrigen(pagoId: string, p: PagoPasarela): Promise<string | null> {
  if (!liveModeCoincide(p.liveMode)) return "PAGO_ENTORNO_NO_COINCIDE";
  const cuenta = await cuentaDePago(pagoId);
  if (cuenta.conexionId) {
    const vendedor = await cuentaVendedorDeConexion(cuenta.conexionId);
    if (!vendedor || !p.collectorId || vendedor !== p.collectorId) return "PAGO_VENDEDOR_NO_COINCIDE";
  }
  return null;
}

/**
 * Contracargo, mediación o reembolso hecho fuera de StylerNow (desde el panel de Mercado Pago del
 * negocio). El origen ya fue verificado. No se mueve dinero ni se reescribe el pago:
 *  - disputa → EN_DISPUTA (el libro lo anota como REQUIERE_REVISION, migración 122);
 *  - reembolso propio (fila en `reembolso`) → lo concilia su worker (116), aquí no se toca;
 *  - reembolso externo → auditoría para revisión manual (no hay registro propio que conciliar).
 */
async function aplicarPosterior(pagoId: string, p: PagoPasarela): Promise<ResultadoSincronizacion> {
  const admin = createAdminClient();

  if (ESTADOS_DISPUTA.has(p.estadoCrudo)) {
    // Función de la migración 130 (aún no está en los tipos generados).
    const rpc = (admin as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc.bind(admin);
    const { data, error } = await rpc("pago_registrar_disputa", {
      p_pago_id: pagoId,
      p_id_transaccion: p.id,
      p_estado_proveedor: p.estadoCrudo,
    });
    if (error) throw new Error(`pago_registrar_disputa: ${error.message}`);
    const r = (data ?? {}) as { procesado?: boolean; motivo?: string; reserva_id?: string | null };
    if (r.procesado) return { estado: "EN_DISPUTA", reservaId: r.reserva_id ?? null };
    return { estado: "SIN_CAMBIOS", motivo: r.motivo ?? "SIN_EFECTO" };
  }

  // Reembolso: ¿lo pidió StylerNow? Entonces lo concilia el worker de reembolsos.
  const { data: propios } = await admin.from("reembolso").select("id").eq("pago_id", pagoId).limit(1);
  if ((propios ?? []).length > 0) return { estado: "SIN_CAMBIOS", motivo: "REEMBOLSO_PROPIO_EN_CONCILIACION" };

  const { data: ya } = await admin
    .from("evento_auditoria")
    .select("id")
    .eq("entidad_id", pagoId)
    .eq("accion", "PAGO_REEMBOLSO_EXTERNO")
    .limit(1);
  if ((ya ?? []).length === 0) {
    const { data: fila } = await admin.from("pago").select("negocio_id, estado").eq("id", pagoId).maybeSingle();
    await admin.from("evento_auditoria").insert({
      entidad_tipo: "pago",
      entidad_id: pagoId,
      accion: "PAGO_REEMBOLSO_EXTERNO",
      actor_tipo: "SISTEMA",
      negocio_id: (fila as { negocio_id?: string } | null)?.negocio_id ?? null,
      payload_despues: { id_transaccion: p.id, estado_proveedor: p.estadoCrudo, estado_local: (fila as { estado?: string } | null)?.estado ?? null },
    });
  }
  return { estado: "REQUIERE_REVISION", motivo: "REEMBOLSO_EXTERNO" };
}

async function aplicar(pagoId: string, pagoPasarela: PagoPasarela): Promise<ResultadoSincronizacion> {
  const admin = createAdminClient();

  const posterior = ESTADOS_DISPUTA.has(pagoPasarela.estadoCrudo) || ESTADOS_REEMBOLSO.has(pagoPasarela.estadoCrudo);
  if (pagoPasarela.estado === "PENDIENTE" && !posterior) return { estado: "PENDIENTE" };

  // Directiva Sandbox, etapas 2 y 5: el pago debe venir del entorno correcto y, si es de un negocio,
  // haber sido recibido por la cuenta de ESE negocio. Si no, no se aplica nada y queda en auditoría.
  const problema = await verificarOrigen(pagoId, pagoPasarela);
  if (problema) {
    await admin.from("evento_auditoria").insert({
      entidad_tipo: "pago",
      entidad_id: pagoId,
      accion: problema,
      actor_tipo: "SISTEMA",
      payload_despues: { id_transaccion: pagoPasarela.id, live_mode: pagoPasarela.liveMode, collector_id: pagoPasarela.collectorId },
    });
    return { estado: "SIN_CAMBIOS", motivo: problema };
  }

  if (posterior) return aplicarPosterior(pagoId, pagoPasarela);

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
      payment_type_id: pagoPasarela.tipoMetodo,
      transaction_amount: pagoPasarela.monto,
      // Evidencia financiera del proveedor (sin datos del pagador): la usa el libro (129).
      live_mode: pagoPasarela.liveMode,
      collector_id: pagoPasarela.collectorId,
      net_received_amount: pagoPasarela.netoRecibido,
      fee_details: pagoPasarela.comisiones,
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
export interface OrigenNotificacion {
  /** Conexión puesta por nosotros en la `notification_url` del cobro (`?c=`). */
  conexionId?: string | null;
  /** `user_id` del vendedor que trae la notificación cuando llega por la URL del panel. */
  cuentaVendedor?: string | null;
}

/**
 * Igual que `sincronizarDesdeTransaccion`, pero devuelve también la traza para el registro del
 * webhook. Si la notificación trae `?c=`, manda esa conexión. Si no, y trae el `user_id` del vendedor,
 * se usan las conexiones CONECTADAS de esa cuenta: el pago debe estar ligado a una de ellas y su
 * collector debe ser esa cuenta (se verifica en `aplicar`). Sin ninguno de los dos, es la cuenta de
 * StylerNow (suscripciones y cobros de plataforma).
 */
export async function sincronizarNotificacion(
  idTransaccion: string,
  origen: OrigenNotificacion = {}
): Promise<{ resultado: ResultadoSincronizacion; traza: TrazaSincronizacion }> {
  const traza: TrazaSincronizacion = { pagoId: null, negocioId: null, estadoProveedor: null, liveMode: null };

  let conexionId = origen.conexionId ?? null;
  let candidatas: string[] | null = null;
  if (!conexionId && origen.cuentaVendedor) {
    candidatas = await conexionesDeCuenta(origen.cuentaVendedor);
    if (candidatas.length === 0) {
      return { resultado: { estado: "SIN_CAMBIOS", motivo: "VENDEDOR_SIN_CONEXION" }, traza };
    }
    conexionId = candidatas[0]; // todas son de la misma cuenta de Mercado Pago: cualquier token la consulta
  }

  const token = conexionId ? await tokenDeConexion(conexionId) : undefined;
  const pasarela = await obtenerPago(idTransaccion, token);
  traza.estadoProveedor = pasarela.estadoCrudo;
  traza.liveMode = pasarela.liveMode;

  if (candidatas && pasarela.collectorId !== origen.cuentaVendedor) {
    return { resultado: { estado: "SIN_CAMBIOS", motivo: "PAGO_VENDEDOR_NO_COINCIDE" }, traza };
  }

  const ref = pasarela.referenciaExterna;
  // Venta propia del vendedor, no creada por StylerNow (nuestras referencias son el UUID del pago).
  if (candidatas && !(ref && /^[0-9a-f-]{36}$/i.test(ref))) {
    return { resultado: { estado: "SIN_CAMBIOS", motivo: "PAGO_AJENO_A_STYLERNOW" }, traza };
  }
  if (candidatas && ref) {
    // El pago decide cuál de las conexiones de esa cuenta es la suya.
    const { data } = await (createAdminClient() as unknown as FromPago).from("pago").select("conexion_pago_id").eq("id", ref).maybeSingle();
    const suya = (data as { conexion_pago_id: string | null } | null)?.conexion_pago_id ?? null;
    if (suya && candidatas.includes(suya)) conexionId = suya;
  }

  const resultado = await sincronizarConPago(pasarela, token, conexionId, { reembolsarHuerfano: !candidatas });

  if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
    const { data } = await (createAdminClient() as unknown as FromPago).from("pago").select("id, negocio_id").eq("id", ref).maybeSingle();
    const f = data as { id: string; negocio_id: string | null } | null;
    traza.pagoId = f?.id ?? null;
    traza.negocioId = f?.negocio_id ?? null;
  }
  return { resultado, traza };
}

type FromPago = {
  from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } };
};

export async function sincronizarDesdeTransaccion(
  idTransaccion: string,
  conexionId: string | null = null
): Promise<ResultadoSincronizacion> {
  const token = conexionId ? await tokenDeConexion(conexionId) : undefined;
  const pasarela = await obtenerPago(idTransaccion, token);
  return sincronizarConPago(pasarela, token, conexionId, { reembolsarHuerfano: true });
}

async function sincronizarConPago(
  pasarela: PagoPasarela,
  token: string | undefined,
  conexionId: string | null,
  opciones: { reembolsarHuerfano: boolean }
): Promise<ResultadoSincronizacion> {
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
    // Si la cuenta se identificó solo por el user_id del aviso (URL del panel), NO se reembolsa
    // automáticamente: ese vendedor puede tener ventas ajenas a StylerNow en su cuenta.
    if (!opciones.reembolsarHuerfano) return { estado: "REQUIERE_REVISION", motivo: "HUERFANO_CUENTA_VENDEDOR" };
    if (pasarela.estado === "APROBADO") await reembolsar(pasarela.id, undefined, `huerfano-${pasarela.id}`, token);
    return { estado: "REEMBOLSADO", motivo: "HUERFANO" };
  }

  return aplicar(pago.id, pasarela);
}
