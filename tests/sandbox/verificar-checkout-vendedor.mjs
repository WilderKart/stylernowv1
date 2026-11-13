#!/usr/bin/env node
/**
 * Verificación en SANDBOX del modelo "Checkout Pro con el token del vendedor, sin split ni comisión".
 *
 * Prueba las evidencias A (receptor = vendedor) y B (creado con el token del vendedor, sin split/fee).
 * NO prueba la liquidación real (evidencia C): eso requiere una prueba real autorizada (ver informe).
 *
 * Seguridad:
 *  - El token del vendedor se pasa por variable de entorno al ejecutar (no se lee ni se escribe .env).
 *  - Se niega a operar si la cuenta NO es un usuario de prueba de Mercado Pago (tag "test_user").
 *  - Nunca imprime tokens ni datos del pagador.
 *
 * Uso (PowerShell o bash), con el access token de la CUENTA VENDEDOR DE PRUEBA:
 *   VENDEDOR_TOKEN_PRUEBA=... node tests/sandbox/verificar-checkout-vendedor.mjs preparar [--con-pse]
 *   VENDEDOR_TOKEN_PRUEBA=... node tests/sandbox/verificar-checkout-vendedor.mjs verificar <external_reference>
 *   VENDEDOR_TOKEN_PRUEBA=... node tests/sandbox/verificar-checkout-vendedor.mjs reembolsar <payment_id> <monto>
 */
import { randomUUID } from "node:crypto";

const TOKEN = process.env.VENDEDOR_TOKEN_PRUEBA ?? "";
const API = "https://api.mercadopago.com";
const [, , accion, arg1, arg2] = process.argv;

function salir(msg) {
  console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
  process.exit(1);
}
if (!TOKEN) salir("Falta VENDEDOR_TOKEN_PRUEBA (token de la cuenta vendedor de prueba).");

async function mp(ruta, init = {}) {
  const res = await fetch(API + ruta, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return { status: res.status, cuerpo: await res.json().catch(() => null) };
}

const me = await mp("/users/me");
if (me.status !== 200) salir(`No se pudo identificar la cuenta (HTTP ${me.status}).`);
const esPrueba = (me.cuerpo?.tags ?? []).includes("test_user");
if (!esPrueba) salir("La cuenta NO es un usuario de prueba de Mercado Pago. Este script solo opera en sandbox.");
const vendedorId = String(me.cuerpo.id);

if (accion === "preparar") {
  const conPse = process.argv.includes("--con-pse");
  const ref = `stylernow-sandbox-${randomUUID()}`;
  const r = await mp("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": ref },
    body: JSON.stringify({
      items: [{ id: "anticipo", title: "Anticipo de prueba StylerNow", quantity: 1, unit_price: 10000, currency_id: "COP" }],
      external_reference: ref,
      // Sin marketplace_fee: ninguna distribución de fondos.
      payment_methods: { excluded_payment_types: conPse ? [{ id: "ticket" }] : [{ id: "bank_transfer" }, { id: "ticket" }] },
      statement_descriptor: "STYLERNOW",
    }),
  });
  console.log(
    JSON.stringify(
      {
        ok: r.status === 201,
        http: r.status,
        error: r.status >= 400 ? r.cuerpo?.message : undefined,
        vendedor_id: vendedorId,
        external_reference: ref,
        preferencia_creada: Boolean(r.cuerpo?.id),
        marketplace_fee_en_respuesta: r.cuerpo?.marketplace_fee ?? null,
        collector_id_preferencia: r.cuerpo?.collector_id != null ? String(r.cuerpo.collector_id) : null,
        collector_es_vendedor: r.cuerpo?.collector_id != null ? String(r.cuerpo.collector_id) === vendedorId : null,
        pse_habilitado_en_prueba: conPse,
        url_pago_sandbox: r.cuerpo?.sandbox_init_point ?? r.cuerpo?.init_point ?? null,
        siguiente_paso:
          "Abrir url_pago_sandbox en ventana de incógnito, pagar con la cuenta compradora de prueba (o tarjeta de prueba, titular APRO). Luego: verificar <external_reference>.",
      },
      null,
      2
    )
  );
} else if (accion === "verificar") {
  if (!arg1) salir("Falta external_reference.");
  const r = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(arg1)}&sort=date_created&criteria=desc`);
  const pagos = (r.cuerpo?.results ?? []).map((p) => ({
    payment_id: String(p.id),
    estado: p.status,
    detalle: p.status_detail,
    live_mode: p.live_mode,
    medio: `${p.payment_method_id}:${p.payment_type_id}`,
    monto: p.transaction_amount,
    moneda: p.currency_id,
    collector_id: p.collector_id != null ? String(p.collector_id) : null,
    evidencia_A_receptor_es_vendedor: p.collector_id != null && String(p.collector_id) === vendedorId,
    evidencia_B_sin_fee_plataforma: !(p.fee_details ?? []).some((f) => f.type === "application_fee") && !p.marketplace_fee,
    sandbox: p.live_mode === false,
    comision_proveedor: (p.fee_details ?? []).filter((f) => f.type !== "application_fee").reduce((a, f) => a + (f.amount ?? 0), 0),
    neto_vendedor: p.transaction_details?.net_received_amount ?? null,
  }));
  console.log(JSON.stringify({ ok: r.status === 200, http: r.status, vendedor_id: vendedorId, pagos, nota: "La evidencia C (liquidación real) NO se demuestra en sandbox." }, null, 2));
} else if (accion === "reembolsar") {
  if (!/^\d+$/.test(arg1 ?? "") || !(Number(arg2) > 0)) salir("Uso: reembolsar <payment_id> <monto>");
  const clave = `stylernow-sandbox-reembolso-${arg1}-${arg2}`;
  const r1 = await mp(`/v1/payments/${arg1}/refunds`, { method: "POST", headers: { "X-Idempotency-Key": clave }, body: JSON.stringify({ amount: Number(arg2) }) });
  const r2 = await mp(`/v1/payments/${arg1}/refunds`, { method: "POST", headers: { "X-Idempotency-Key": clave }, body: JSON.stringify({ amount: Number(arg2) }) });
  const p = await mp(`/v1/payments/${arg1}`);
  console.log(
    JSON.stringify(
      {
        ok: r1.status < 300,
        http: r1.status,
        estado_reembolso: r1.cuerpo?.status ?? null,
        error: r1.status >= 400 ? r1.cuerpo?.message : undefined,
        repetido_misma_clave_no_duplica: r1.cuerpo?.id != null && r1.cuerpo?.id === r2.cuerpo?.id,
        pago_estado: p.cuerpo?.status,
        total_reembolsado: p.cuerpo?.transaction_amount_refunded ?? null,
        live_mode: p.cuerpo?.live_mode,
      },
      null,
      2
    )
  );
} else {
  salir("Acción: preparar [--con-pse] | verificar <external_reference> | reembolsar <payment_id> <monto>");
}
