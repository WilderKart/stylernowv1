"use server";

import { proveedorDe } from "@/lib/pagos/proveedores/adaptadores";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";

type Resultado = { ok: true } | { ok: false; error: string };

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso sobre este negocio.",
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  ALLFATHER_REQUIERE_COTIZACION: "El plan Allfather se cotiza con nuestro equipo de ventas.",
  CICLO_INVALIDO: "Elige facturación mensual o anual.",
  PAIS_NO_DISPONIBLE: "StylerNow todavía no está disponible en ese país.",
  PLAN_SIN_PRECIO_EN_PAIS: "Ese plan no tiene precio definido en tu país.",
  COBRO_NO_DISPONIBLE_PAIS:
    "El cobro automático todavía no está habilitado en tu país. Te avisaremos apenas esté listo para iniciar tu prueba de 14 días.",
  METODO_PAGO_REQUERIDO: "Para iniciar la prueba debes registrar un método de pago.",
  VERIFICACION_INCOMPLETA: "Completa teléfono, documento y verificación del dispositivo para iniciar la prueba.",
  YA_TIENE_SUSCRIPCION: "Tu negocio ya tiene un plan en curso.",
  PRUEBA_YA_USADA: "Esta prueba ya fue usada (negocio, teléfono, documento, correo o dispositivo). Elige un plan para continuar.",
  PAIS_FIJO_CON_PLAN_VIGENTE: "El país no se puede cambiar con un plan en curso. Contacta a soporte.",
  PROVEEDOR_NO_CONFIGURADO: "La pasarela de pago de tu país todavía no está habilitada.",
};

function traducir(mensaje: string) {
  const clave = Object.keys(MENSAJES).find((k) => mensaje.includes(k));
  return clave ? MENSAJES[clave] : mensaje;
}

/** Huella irreversible (HMAC) para detectar pruebas repetidas sin guardar teléfono ni documento en claro. */
function huella(valor: string) {
  const pepper = process.env.PRUEBA_HASH_PEPPER ?? process.env.SUPABASE_SECRET_KEY;
  if (!pepper) throw new Error("Falta PRUEBA_HASH_PEPPER en el entorno.");
  return createHmac("sha256", pepper).update(valor.trim().toLowerCase().replace(/[\s.\-]/g, "")).digest("hex");
}

export async function elegirPais(negocioId: string, pais: string): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("elegir_pais_negocio", { p_negocio_id: negocioId, p_pais: pais });
    if (error) return { ok: false, error: traducir(error.message) };
    revalidatePath("/panel/onboarding");
    revalidatePath("/panel/suscripcion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface DatosPrueba {
  negocioId: string;
  plan: "RAVEN" | "JARL" | "VALHALLA";
  ciclo: "MENSUAL" | "ANUAL";
  telefono: string;
  documento: string;
  /** Identificador estable del dispositivo (generado en el navegador). */
  dispositivoId: string;
  /** Token del método de pago devuelto por el SDK de la pasarela del país. */
  metodoPagoToken: string;
}

/**
 * Inicia la prueba de 14 días. Exige método de pago válido; cobra solo al terminar
 * (cron diario). Una sola prueba por negocio/teléfono/documento/correo/dispositivo.
 */
export async function iniciarPrueba(d: DatosPrueba): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: MENSAJES.NO_AUTENTICADO };

    const { data: negocio } = await supabase.from("negocio").select("pais_codigo").eq("id", d.negocioId).single();
    if (!negocio) return { ok: false, error: MENSAJES.NO_AUTORIZADO };
    const { data: pais } = await supabase.from("pais").select("pasarela, cobro_recurrente_habilitado").eq("codigo", negocio.pais_codigo).single();
    if (!pais) return { ok: false, error: MENSAJES.PAIS_NO_DISPONIBLE };

    const proveedor = proveedorDe(pais.pasarela);
    if (!pais.cobro_recurrente_habilitado || !proveedor.soportaCobroRecurrente()) {
      return { ok: false, error: MENSAJES.COBRO_NO_DISPONIBLE_PAIS };
    }

    const metodo = await proveedor.registrarMetodoPago({ token: d.metodoPagoToken, negocioId: d.negocioId, email: user.email ?? "" });
    if (!metodo.ok) return { ok: false, error: traducir(metodo.codigo) };

    const { error } = await supabase.rpc("iniciar_prueba_negocio", {
      p_negocio_id: d.negocioId,
      p_plan_codigo: d.plan,
      p_ciclo: d.ciclo,
      p_metodo_pago_ref: metodo.ref,
      p_metodo_pago_proveedor: proveedor.id,
      p_telefono_hash: huella(d.telefono),
      p_documento_hash: huella(d.documento),
      p_dispositivo_hash: huella(d.dispositivoId),
    });
    if (error) return { ok: false, error: traducir(error.message) };

    revalidatePath("/panel");
    revalidatePath("/panel/suscripcion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
