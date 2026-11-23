"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { exigirOperativo, MENSAJE_RESTRINGIDA } from "@/lib/suscripcion/estado-operativo";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type TipoDescuento = "PORCENTAJE" | "MONTO" | "DOS_POR_UNO";

export interface Promocion {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipoDescuento: TipoDescuento;
  valor: number | null;
  diasSemana: number[] | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activa: boolean;
}

export interface EventoPromocion {
  id: string;
  accion: string;
  fecha: string;
  titulo: string | null;
}

type Resultado<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

const MENSAJES: Record<string, string> = {
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  NO_AUTORIZADO: "Solo el dueño del negocio puede administrar las promociones.",
  SUSCRIPCION_RESTRINGIDA: MENSAJE_RESTRINGIDA,
  oferta_negocio_porcentaje_max_chk: "Un descuento en porcentaje no puede ser mayor que 100 %.",
};

function traducir(m: string) {
  const k = Object.keys(MENSAJES).find((c) => m.includes(c));
  return k ? MENSAJES[k] : "No pudimos guardar la promoción. Revisa los datos e intenta de nuevo.";
}

/** Negocio del dueño derivado de la sesión en el servidor (nunca del navegador). Solo el dueño: guardian y profesional quedan fuera. */
async function sesionDueno(opciones?: { requerirOperativo?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const contexto = await resolverContexto();
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId || contexto.userId !== user.id) throw new Error("NO_AUTORIZADO");
  if (opciones?.requerirOperativo) {
    const operativo = await exigirOperativo(contexto.negocioId);
    if (!operativo.ok) throw new Error("SUSCRIPCION_RESTRINGIDA");
  }
  return { supabase, negocioId: contexto.negocioId };
}

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");
const entrada = z
  .object({
    titulo: z.string().trim().min(3, "El título debe tener entre 3 y 80 caracteres.").max(80, "El título debe tener entre 3 y 80 caracteres."),
    descripcion: z.string().trim().max(300, "La descripción admite hasta 300 caracteres.").nullable().optional(),
    tipoDescuento: z.enum(["PORCENTAJE", "MONTO", "DOS_POR_UNO"]),
    valor: z.number().finite().nullable().optional(),
    diasSemana: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
    vigenteDesde: fechaIso,
    vigenteHasta: fechaIso.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.vigenteHasta && v.vigenteHasta < v.vigenteDesde) ctx.addIssue({ code: "custom", path: ["vigenteHasta"], message: "La fecha final no puede ser anterior a la inicial." });
    if (v.tipoDescuento === "DOS_POR_UNO") return;
    if (v.valor == null || !(v.valor > 0)) ctx.addIssue({ code: "custom", path: ["valor"], message: "El valor debe ser mayor que 0." });
    else if (v.tipoDescuento === "PORCENTAJE" && v.valor > 100) ctx.addIssue({ code: "custom", path: ["valor"], message: "El porcentaje no puede ser mayor que 100 %." });
  });

export type EntradaPromocion = z.input<typeof entrada>;

function aFila(v: z.output<typeof entrada>) {
  return {
    titulo: v.titulo,
    descripcion: v.descripcion?.length ? v.descripcion : null,
    tipo_descuento: v.tipoDescuento,
    valor: v.tipoDescuento === "DOS_POR_UNO" ? null : (v.valor ?? null),
    dias_semana: v.diasSemana && v.diasSemana.length ? [...new Set(v.diasSemana)].sort() : null,
    vigente_desde: v.vigenteDesde,
    vigente_hasta: v.vigenteHasta ?? null,
  };
}

export async function listarPromociones(): Promise<Resultado<{ promociones: Promocion[]; historial: EventoPromocion[] }>> {
  try {
    const { supabase, negocioId } = await sesionDueno();
    const [{ data, error }, { data: ev }] = await Promise.all([
      supabase
        .from("oferta_negocio")
        .select("id, titulo, descripcion, tipo_descuento, valor, dias_semana, vigente_desde, vigente_hasta, activa")
        .eq("negocio_id", negocioId)
        .order("created_at", { ascending: false }),
      supabase
        .from("evento_auditoria")
        .select("id, accion, created_at, payload_despues, payload_antes")
        .eq("negocio_id", negocioId)
        .eq("entidad_tipo", "oferta_negocio")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (error) return { ok: false, error: "No pudimos cargar tus promociones." };
    return {
      ok: true,
      data: {
        promociones: (data ?? []).map((o) => ({
          id: o.id,
          titulo: o.titulo,
          descripcion: o.descripcion,
          tipoDescuento: o.tipo_descuento as TipoDescuento,
          valor: o.valor === null ? null : Number(o.valor),
          diasSemana: o.dias_semana,
          vigenteDesde: o.vigente_desde,
          vigenteHasta: o.vigente_hasta,
          activa: o.activa,
        })),
        historial: (ev ?? []).map((e) => {
          const p = (e.payload_despues ?? e.payload_antes ?? {}) as { titulo?: string };
          return { id: e.id, accion: e.accion, fecha: e.created_at, titulo: p.titulo ?? null };
        }),
      },
    };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}

export async function crearPromocion(datos: EntradaPromocion): Promise<Resultado> {
  try {
    const p = entrada.safeParse(datos);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
    const { supabase, negocioId } = await sesionDueno({ requerirOperativo: true });
    const { error } = await supabase.from("oferta_negocio").insert({ ...aFila(p.data), negocio_id: negocioId, activa: true });
    if (error) return { ok: false, error: traducir(error.message) };
    revalidatePath("/panel/promociones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}

export async function actualizarPromocion(id: string, datos: EntradaPromocion): Promise<Resultado> {
  try {
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Promoción inválida." };
    const p = entrada.safeParse(datos);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
    const { supabase, negocioId } = await sesionDueno({ requerirOperativo: true });
    const { data, error } = await supabase.from("oferta_negocio").update(aFila(p.data)).eq("id", id).eq("negocio_id", negocioId).select("id");
    if (error) return { ok: false, error: traducir(error.message) };
    if (!data?.length) return { ok: false, error: "No encontramos esa promoción en tu negocio." };
    revalidatePath("/panel/promociones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}

/** Activar / pausar: la promoción deja de mostrarse pero se conserva con su historial. */
export async function cambiarEstadoPromocion(id: string, activa: boolean): Promise<Resultado> {
  try {
    if (!z.string().uuid().safeParse(id).success || typeof activa !== "boolean") return { ok: false, error: "Promoción inválida." };
    const { supabase, negocioId } = await sesionDueno({ requerirOperativo: true });
    const { data, error } = await supabase.from("oferta_negocio").update({ activa }).eq("id", id).eq("negocio_id", negocioId).select("id");
    if (error) return { ok: false, error: traducir(error.message) };
    if (!data?.length) return { ok: false, error: "No encontramos esa promoción en tu negocio." };
    revalidatePath("/panel/promociones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}

/** Ninguna otra tabla referencia una promoción, así que eliminarla es seguro; el evento queda en la auditoría del negocio. */
export async function eliminarPromocion(id: string): Promise<Resultado> {
  try {
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Promoción inválida." };
    const { supabase, negocioId } = await sesionDueno({ requerirOperativo: true });
    const { data, error } = await supabase.from("oferta_negocio").delete().eq("id", id).eq("negocio_id", negocioId).select("id");
    if (error) return { ok: false, error: traducir(error.message) };
    if (!data?.length) return { ok: false, error: "No encontramos esa promoción en tu negocio." };
    revalidatePath("/panel/promociones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}
