"use server";

import { proveedorDe } from "@/lib/pagos/proveedores/adaptadores";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type Resultado = { ok: true } | { ok: false; error: string };
/** RPC de la migración 118, aún sin tipos generados. */
type RpcSinTipos = {
  rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso sobre este negocio.",
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  SIGNATURE_REQUIERE_COTIZACION: "El plan Signature se cotiza con nuestro equipo de ventas.",
  CICLO_INVALIDO: "Elige facturación mensual o anual.",
  PAIS_NO_DISPONIBLE: "StylerNow todavía no está disponible en ese país.",
  PLAN_SIN_PRECIO_EN_PAIS: "Ese plan no tiene precio definido en tu país.",
  COBRO_NO_DISPONIBLE_PAIS:
    "El cobro automático todavía no está habilitado en tu país. Puedes iniciar tu prueba sin tarjeta.",
  METODO_PAGO_REQUERIDO: "Para iniciar la prueba debes registrar un método de pago.",
  MODALIDAD_PRUEBA_NO_PERMITIDA: "Por ahora la prueba se inicia sin tarjeta. Registra tu método de pago cuando elijas tu plan.",
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

const esquemaPrueba = z.object({
  negocioId: z.string().uuid(),
  plan: z.enum(["ESSENTIAL", "STUDIO", "PRESTIGE"]),
  ciclo: z.enum(["MENSUAL", "ANUAL"]),
  telefono: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/),
  documento: z.string().trim().regex(/^[0-9A-Za-z.\-]{5,20}$/),
  dispositivoId: z.string().trim().min(16).max(200),
  /** Vacío = prueba sin tarjeta (modalidad por defecto). */
  metodoPagoToken: z.string().trim().max(500).optional().default(""),
});

export type DatosPrueba = z.input<typeof esquemaPrueba>;

/**
 * Inicia la prueba gratuita (duración y modalidad las define Super Admin, migración 118).
 * Sin tarjeta no depende del cobro recurrente: al vencer pasa a REQUIERE_PLAN. Con tarjeta
 * se cobra al terminar (cron diario). Una sola prueba por negocio/teléfono/documento/correo/dispositivo.
 *
 * Cero confianza: la sesión se verifica aquí, las huellas HMAC se calculan aquí y la base
 * de datos solo acepta la llamada desde el servidor (service_role) con el usuario verificado.
 */
export async function iniciarPrueba(entrada: DatosPrueba): Promise<Resultado> {
  try {
    const parsed = esquemaPrueba.safeParse(entrada);
    if (!parsed.success) return { ok: false, error: MENSAJES.VERIFICACION_INCOMPLETA };
    const d = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false, error: MENSAJES.NO_AUTENTICADO };

    let metodoRef: string | null = null;
    let proveedorId: string | null = null;

    if (d.metodoPagoToken) {
      // Con tarjeta: requiere país con cobro recurrente y un proveedor que lo soporte.
      const { data: negocio } = await supabase.from("negocio").select("pais_codigo").eq("id", d.negocioId).single();
      if (!negocio) return { ok: false, error: MENSAJES.NO_AUTORIZADO };
      const { data: pais } = await supabase
        .from("pais")
        .select("pasarela, cobro_recurrente_habilitado")
        .eq("codigo", negocio.pais_codigo)
        .single();
      if (!pais) return { ok: false, error: MENSAJES.PAIS_NO_DISPONIBLE };
      const proveedor = proveedorDe(pais.pasarela);
      if (!pais.cobro_recurrente_habilitado || !proveedor.soportaCobroRecurrente()) {
        return { ok: false, error: MENSAJES.COBRO_NO_DISPONIBLE_PAIS };
      }
      const metodo = await proveedor.registrarMetodoPago({ token: d.metodoPagoToken, negocioId: d.negocioId, email: user.email });
      if (!metodo.ok) return { ok: false, error: traducir(metodo.codigo) };
      metodoRef = metodo.ref;
      proveedorId = proveedor.id;
    }

    const { error } = await (createAdminClient() as unknown as RpcSinTipos).rpc("iniciar_prueba_negocio_srv", {
      p_actor: user.id,
      p_negocio_id: d.negocioId,
      p_plan_codigo: d.plan,
      p_ciclo: d.ciclo,
      p_metodo_pago_ref: metodoRef,
      p_metodo_pago_proveedor: proveedorId,
      p_telefono_hash: huella(d.telefono),
      p_documento_hash: huella(d.documento),
      p_email_hash: huella(user.email),
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
