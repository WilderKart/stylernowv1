import "server-only";
import { proveedorDe } from "@/lib/pagos/proveedores/adaptadores";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatearMoneda } from "./moneda";
import { calcularPrecio, type CicloFacturacion } from "./precios";

/**
 * Ciclo diario de suscripciones (lo dispara /api/cron/diario con service_role):
 *  1. Avisos de primer cobro, 3 días y 1 día antes (email).
 *  2. Cobro automático de las pruebas vencidas contra la pasarela del país.
 *  3. Mantenimiento: mora vencida (3 días de gracia) → suspendida/oculta; cierra fundadores vencidos.
 * El resultado del cobro lo registra `registrar_resultado_cobro` (única vía para cambiar el estado).
 */
type Admin = ReturnType<typeof createAdminClient>;

async function enviarCorreo(para: string, asunto: string, html: string) {
  const token = process.env.RESEND_API_KEY;
  if (!token) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "StylerNow <notificaciones@mail.stylernow.com>", to: para, subject: asunto, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function enviarAvisos(admin: Admin) {
  const { data: avisos } = await admin.rpc("avisos_prueba_pendientes");
  let enviados = 0;
  for (const a of avisos ?? []) {
    const { data: usuario } = await admin.auth.admin.getUserById(a.owner_user_id);
    const email = usuario.user?.email;
    if (!email) continue;
    const dias = a.tipo === "1D" ? "mañana" : "en 3 días";
    const fecha = new Date(a.fecha_cobro).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
    // Sin tarjeta no hay cobro automático: se invita a elegir plan (migración 118).
    // Sin cobro automático (COBRO_AUTOMATICO_HABILITADO = false), nunca se anuncia un cobro a la tarjeta.
    const conTarjeta = COBRO_AUTOMATICO_HABILITADO && (a as { con_tarjeta?: boolean }).con_tarjeta === true;
    const cuerpo = conTarjeta
      ? `<h2>Tu prueba gratuita termina ${dias}</h2><p>El ${fecha} se hará el primer cobro de tu plan con el método de pago que registraste. ` +
        `Si no quieres continuar, cancela antes desde Plan y facturación.</p>`
      : `<h2>Tu prueba gratuita termina ${dias}</h2><p>El ${fecha} termina tu prueba. No te cobraremos nada automáticamente: ` +
        `para seguir recibiendo reservas, paga tu plan desde Plan y facturación. Si no alcanzas, tendrás unos días de gracia.</p>`;
    const ok = await enviarCorreo(email, `Tu prueba de StylerNow termina ${dias}`, cuerpo);
    if (ok) {
      await admin.rpc("marcar_aviso_prueba", { p_negocio_id: a.negocio_id, p_tipo: a.tipo });
      enviados++;
    }
  }
  return enviados;
}

async function cobrarPruebasVencidas(admin: Admin) {
  const { data: pruebas } = await admin.rpc("pruebas_por_cobrar");
  const resumen = { cobradas: 0, fallidas: 0 };

  for (const p of pruebas ?? []) {
    const [{ data: pais }, { data: precio }, { data: fundador }, { data: negocio }] = await Promise.all([
      admin.from("pais").select("moneda, locale, pasarela, anual_meses_pagados").eq("codigo", p.pais_codigo).single(),
      admin.from("plan_precio").select("precio_mensual").eq("plan_codigo", p.plan_codigo).eq("pais_codigo", p.pais_codigo).single(),
      admin.from("suscripcion_fundador").select("descuento_pct").eq("negocio_id", p.negocio_id).eq("estado", "ACTIVO").maybeSingle(),
      admin.from("negocio").select("owner_user_id").eq("id", p.negocio_id).single(),
    ]);

    let exito = false;
    let motivo = "DATOS_INCOMPLETOS";

    if (pais && precio?.precio_mensual != null && p.metodo_pago_ref) {
      const calculado = calcularPrecio({
        precioMensual: Number(precio.precio_mensual),
        ciclo: p.ciclo as CicloFacturacion,
        mesesPagadosAnual: pais.anual_meses_pagados,
        descuentoFundadorPct: fundador ? Number(fundador.descuento_pct) : 0,
      });
      const proveedor = proveedorDe(pais.pasarela);
      if (proveedor.soportaCobroRecurrente()) {
        const r = await proveedor.cobrarSuscripcion({
          ref: p.metodo_pago_ref,
          monto: calculado.final,
          moneda: pais.moneda,
          descripcion: `StylerNow · plan ${p.plan_codigo} (${formatearMoneda(calculado.final, pais.moneda, pais.locale)})`,
          idempotencyKey: `susc-${p.negocio_id}-${p.ciclo}-primer-cobro`,
        });
        exito = r.ok;
        motivo = r.ok ? "" : r.codigo;
      } else {
        motivo = "PROVEEDOR_NO_SOPORTA_COBRO_RECURRENTE";
      }
    }

    await admin.rpc("registrar_resultado_cobro", { p_negocio_id: p.negocio_id, p_exito: exito, p_motivo: motivo || undefined });
    if (exito) resumen.cobradas++;
    else {
      resumen.fallidas++;
      const { data: u } = negocio ? await admin.auth.admin.getUserById(negocio.owner_user_id) : { data: null };
      if (u?.user?.email) {
        await enviarCorreo(
          u.user.email,
          "No pudimos cobrar tu plan de StylerNow",
          "<h2>No pudimos procesar el cobro</h2><p>Tienes 3 días para actualizar tu método de pago. Pasado ese plazo tu perfil se oculta del mapa hasta que regularices.</p>",
        );
      }
    }
  }
  return resumen;
}

/**
 * Decisión del propietario (2026-11-14): sin cobros automáticos ni Preapproval en esta etapa. Al terminar
 * la prueba, `mantenimiento_suscripciones` (migración 133) la pasa a gracia y el dueño paga su plan por
 * Checkout Pro. El cobro recurrente queda implementado pero apagado; activarlo exige una decisión nueva.
 */
const COBRO_AUTOMATICO_HABILITADO = false;

export async function ejecutarCicloSuscripciones() {
  const admin = createAdminClient();
  const avisos = await enviarAvisos(admin);
  const cobros = COBRO_AUTOMATICO_HABILITADO ? await cobrarPruebasVencidas(admin) : { cobradas: 0, fallidas: 0, deshabilitado: true };
  const { data: mantenimiento } = await admin.rpc("mantenimiento_suscripciones");
  return { avisos_enviados: avisos, cobros, mantenimiento };
}
