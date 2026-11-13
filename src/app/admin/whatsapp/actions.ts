"use server";

import { traducirErrorWhatsApp } from "@/lib/whatsapp/errores";
import { llamarRpcWhatsApp, sesionSuperSUWhatsApp } from "@/lib/whatsapp/servidor";
import { ESTADOS_CONEXION_ADMIN, PROVEEDORES, type ResumenAdminWhatsApp, type Resultado } from "@/lib/whatsapp/tipos";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RUTA = "/admin/whatsapp";
const motivo = z.string().trim().min(5).max(300);

function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: traducirErrorWhatsApp(e instanceof Error ? e.message : String(e)) };
}

export async function obtenerResumenAdminWhatsApp(): Promise<Resultado<ResumenAdminWhatsApp>> {
  try {
    const { supabase } = await sesionSuperSUWhatsApp();
    const { data, error } = await llamarRpcWhatsApp<ResumenAdminWhatsApp>(supabase, "whatsapp_admin_resumen");
    if (error || !data) return fallo(error ?? "SIN_DATOS");
    return { ok: true, data };
  } catch (e) {
    return fallo(e);
  }
}

const esquemaConfig = z.object({
  pctMarketingPlan: z.number().min(0).max(100),
  pctMarketingRecarga: z.number().min(0).max(100),
  mesesVencimientoRecarga: z.number().int().min(1).max(36),
  umbralesAlerta: z.array(z.number().int().min(1).max(100)).min(1).max(5),
  proveedor: z.enum(PROVEEDORES).nullable(),
  motivo,
});

export async function actualizarConfigWhatsApp(entrada: z.input<typeof esquemaConfig>): Promise<Resultado> {
  const c = esquemaConfig.safeParse(entrada);
  if (!c.success) return { ok: false, error: "Revisa los valores (porcentajes 0-100, vencimiento 1-36 meses, 1 a 5 umbrales y motivo)." };
  try {
    const { supabase } = await sesionSuperSUWhatsApp();
    const { error } = await llamarRpcWhatsApp(supabase, "whatsapp_admin_actualizar_config", {
      p_pct_marketing_plan: c.data.pctMarketingPlan,
      p_pct_marketing_recarga: c.data.pctMarketingRecarga,
      p_meses_vencimiento_recarga: c.data.mesesVencimientoRecarga,
      p_umbrales_alerta: c.data.umbralesAlerta,
      p_proveedor: c.data.proveedor,
      p_motivo: c.data.motivo,
    });
    if (error) return fallo(error);
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

const esquemaConexion = z.object({ estado: z.enum(ESTADOS_CONEXION_ADMIN), motivo });

export async function cambiarEstadoConexion(entrada: z.input<typeof esquemaConexion>): Promise<Resultado> {
  const c = esquemaConexion.safeParse(entrada);
  if (!c.success) return { ok: false, error: "Elige un estado válido y escribe un motivo (mínimo 5 caracteres)." };
  try {
    const { supabase } = await sesionSuperSUWhatsApp();
    const { error } = await llamarRpcWhatsApp(supabase, "whatsapp_admin_estado_conexion", { p_estado: c.data.estado, p_motivo: c.data.motivo });
    if (error) return fallo(error);
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

const esquemaPaqueteNuevo = z.object({
  codigo: z.string().trim().regex(/^[A-Z0-9_]{3,40}$/),
  nombre: z.string().trim().min(2).max(60),
  conversaciones: z.number().int().min(1).max(1_000_000),
  precio: z.number().positive().max(100_000_000),
  moneda: z.string().trim().regex(/^[A-Z]{3}$/),
  motivo,
});

export async function crearPaqueteWhatsApp(entrada: z.input<typeof esquemaPaqueteNuevo>): Promise<Resultado> {
  const p = esquemaPaqueteNuevo.safeParse(entrada);
  if (!p.success) return { ok: false, error: "Revisa los datos del paquete." };
  try {
    const { supabase } = await sesionSuperSUWhatsApp();
    const { error } = await llamarRpcWhatsApp(supabase, "whatsapp_admin_crear_paquete", {
      p_codigo: p.data.codigo,
      p_nombre: p.data.nombre,
      p_conversaciones: p.data.conversaciones,
      p_precio: p.data.precio,
      p_moneda: p.data.moneda,
      p_motivo: p.data.motivo,
    });
    if (error) return fallo(error);
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

const esquemaVersion = z.object({
  paqueteId: z.uuid(),
  nombre: z.string().trim().min(2).max(60),
  conversaciones: z.number().int().min(1).max(1_000_000),
  precio: z.number().positive().max(100_000_000),
  motivo,
});

export async function versionarPaqueteWhatsApp(entrada: z.input<typeof esquemaVersion>): Promise<Resultado> {
  const p = esquemaVersion.safeParse(entrada);
  if (!p.success) return { ok: false, error: "Revisa los datos del paquete." };
  try {
    const { supabase } = await sesionSuperSUWhatsApp();
    const { error } = await llamarRpcWhatsApp(supabase, "whatsapp_admin_versionar_paquete", {
      p_paquete_id: p.data.paqueteId,
      p_nombre: p.data.nombre,
      p_conversaciones: p.data.conversaciones,
      p_precio: p.data.precio,
      p_motivo: p.data.motivo,
    });
    if (error) return fallo(error);
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

const esquemaAlternar = z.object({ paqueteId: z.uuid(), activo: z.boolean(), motivo });

export async function alternarPaqueteWhatsApp(entrada: z.input<typeof esquemaAlternar>): Promise<Resultado> {
  const p = esquemaAlternar.safeParse(entrada);
  if (!p.success) return { ok: false, error: "Escribe un motivo (mínimo 5 caracteres)." };
  try {
    const { supabase } = await sesionSuperSUWhatsApp();
    const { error } = await llamarRpcWhatsApp(supabase, "whatsapp_admin_alternar_paquete", {
      p_paquete_id: p.data.paqueteId,
      p_activo: p.data.activo,
      p_motivo: p.data.motivo,
    });
    if (error) return fallo(error);
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}
