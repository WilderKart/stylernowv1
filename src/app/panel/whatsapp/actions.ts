"use server";

import { traducirErrorWhatsApp } from "@/lib/whatsapp/errores";
import { normalizarSegmento } from "@/lib/whatsapp/reglas";
import { llamarRpcWhatsApp, sesionDuenoWhatsApp } from "@/lib/whatsapp/servidor";
import { CATEGORIAS, VARIABLES_PLANTILLA, type EstadoCampana, type ResumenPanelWhatsApp, type Resultado } from "@/lib/whatsapp/tipos";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RUTA = "/panel/whatsapp";

function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: traducirErrorWhatsApp(e instanceof Error ? e.message : String(e)) };
}

const esquemaSegmento = z
  .object({
    dias_sin_visita_min: z.number().int().min(1).max(3650).nullable().optional(),
    visitas_min: z.number().int().min(1).max(1000).nullable().optional(),
    etiqueta: z.string().trim().max(50).nullable().optional(),
  })
  .strict();

export async function obtenerResumenWhatsApp(): Promise<Resultado<ResumenPanelWhatsApp>> {
  try {
    const { supabase, negocioId } = await sesionDuenoWhatsApp();
    const { data, error } = await llamarRpcWhatsApp<ResumenPanelWhatsApp>(supabase, "whatsapp_panel_resumen", { p_negocio_id: negocioId });
    if (error || !data) return fallo(error ?? "SIN_DATOS");
    return { ok: true, data };
  } catch (e) {
    return fallo(e);
  }
}

const esquemaPlantilla = z.object({
  plantillaId: z.uuid().nullable(),
  nombre: z.string().trim().regex(/^[a-z0-9_]{3,60}$/),
  idioma: z.enum(["es", "en"]),
  categoria: z.enum(CATEGORIAS),
  cuerpo: z.string().trim().min(1).max(1024),
  variables: z.array(z.enum(VARIABLES_PLANTILLA)).max(10),
});

export async function guardarPlantilla(entrada: z.input<typeof esquemaPlantilla>): Promise<Resultado<{ id: string }>> {
  const p = esquemaPlantilla.safeParse(entrada);
  if (!p.success) return { ok: false, error: "Revisa los datos de la plantilla." };
  try {
    const { supabase, negocioId } = await sesionDuenoWhatsApp();
    const { data, error } = await llamarRpcWhatsApp<string>(supabase, "whatsapp_plantilla_guardar", {
      p_plantilla_id: p.data.plantillaId,
      p_negocio_id: negocioId,
      p_nombre: p.data.nombre,
      p_idioma: p.data.idioma,
      p_categoria: p.data.categoria,
      p_cuerpo: p.data.cuerpo,
      p_variables: p.data.variables,
    });
    if (error || !data) return fallo(error ?? "SIN_DATOS");
    revalidatePath(RUTA);
    return { ok: true, data: { id: data } };
  } catch (e) {
    return fallo(e);
  }
}

export async function eliminarPlantilla(plantillaId: string): Promise<Resultado> {
  const id = z.uuid().safeParse(plantillaId);
  if (!id.success) return { ok: false, error: "Plantilla inválida." };
  try {
    const { supabase } = await sesionDuenoWhatsApp();
    const { error } = await llamarRpcWhatsApp(supabase, "whatsapp_plantilla_eliminar", { p_plantilla_id: id.data });
    if (error) return fallo(error);
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

export async function contarSegmento(segmento: z.input<typeof esquemaSegmento>): Promise<Resultado<{ conTelefono: number; conConsentimiento: number }>> {
  const s = esquemaSegmento.safeParse(segmento);
  if (!s.success) return { ok: false, error: "Revisa los filtros del segmento." };
  try {
    const { supabase, negocioId } = await sesionDuenoWhatsApp();
    const { data, error } = await llamarRpcWhatsApp<{ con_telefono: number; con_consentimiento: number }>(supabase, "whatsapp_segmento_contar", {
      p_negocio_id: negocioId,
      p_segmento: normalizarSegmento(s.data),
    });
    if (error || !data) return fallo(error ?? "SIN_DATOS");
    return { ok: true, data: { conTelefono: Number(data.con_telefono), conConsentimiento: Number(data.con_consentimiento) } };
  } catch (e) {
    return fallo(e);
  }
}

const esquemaCampana = z.object({
  plantillaId: z.uuid(),
  nombre: z.string().trim().min(2).max(80),
  segmento: esquemaSegmento,
  programadaAt: z.iso.datetime({ offset: true }).nullable(),
});

export async function crearCampana(entrada: z.input<typeof esquemaCampana>): Promise<Resultado<{ id: string }>> {
  const c = esquemaCampana.safeParse(entrada);
  if (!c.success) return { ok: false, error: "Revisa los datos de la campaña." };
  try {
    const { supabase, negocioId } = await sesionDuenoWhatsApp();
    const { data, error } = await llamarRpcWhatsApp<string>(supabase, "whatsapp_campana_crear", {
      p_negocio_id: negocioId,
      p_plantilla_id: c.data.plantillaId,
      p_nombre: c.data.nombre,
      p_segmento: normalizarSegmento(c.data.segmento),
      p_programada_at: c.data.programadaAt,
    });
    if (error || !data) return fallo(error ?? "SIN_DATOS");
    revalidatePath(RUTA);
    return { ok: true, data: { id: data } };
  } catch (e) {
    return fallo(e);
  }
}

export async function programarCampana(campanaId: string): Promise<Resultado<{ estado: EstadoCampana }>> {
  const id = z.uuid().safeParse(campanaId);
  if (!id.success) return { ok: false, error: "Campaña inválida." };
  try {
    const { supabase } = await sesionDuenoWhatsApp();
    const { data, error } = await llamarRpcWhatsApp<EstadoCampana>(supabase, "whatsapp_campana_programar", { p_campana_id: id.data });
    if (error || !data) return fallo(error ?? "SIN_DATOS");
    revalidatePath(RUTA);
    return { ok: true, data: { estado: data } };
  } catch (e) {
    return fallo(e);
  }
}

export async function cancelarCampana(campanaId: string): Promise<Resultado> {
  const id = z.uuid().safeParse(campanaId);
  if (!id.success) return { ok: false, error: "Campaña inválida." };
  try {
    const { supabase } = await sesionDuenoWhatsApp();
    const { error } = await llamarRpcWhatsApp(supabase, "whatsapp_campana_cancelar", { p_campana_id: id.data });
    if (error) return fallo(error);
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

/** Crea la solicitud PENDIENTE_PAGO. El cobro todavía no está habilitado: lo conecta la fase de pagos. */
export async function solicitarRecarga(paqueteId: string): Promise<Resultado<{ compraId: string }>> {
  const id = z.uuid().safeParse(paqueteId);
  if (!id.success) return { ok: false, error: "Paquete inválido." };
  try {
    const { supabase, negocioId } = await sesionDuenoWhatsApp();
    const { data, error } = await llamarRpcWhatsApp<string>(supabase, "whatsapp_solicitar_recarga", {
      p_negocio_id: negocioId,
      p_paquete_id: id.data,
    });
    if (error || !data) return fallo(error ?? "SIN_DATOS");
    revalidatePath(RUTA);
    return { ok: true, data: { compraId: data } };
  } catch (e) {
    return fallo(e);
  }
}

export async function cancelarRecarga(compraId: string): Promise<Resultado> {
  const id = z.uuid().safeParse(compraId);
  if (!id.success) return { ok: false, error: "Solicitud inválida." };
  try {
    const { supabase } = await sesionDuenoWhatsApp();
    const { error } = await llamarRpcWhatsApp(supabase, "whatsapp_cancelar_recarga", { p_compra_id: id.data });
    if (error) return fallo(error);
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}
