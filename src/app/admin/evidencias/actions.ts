"use server";

import { createHash } from "node:crypto";
import { requireSuperSU } from "@/lib/auth/require-supersu";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { ACCIONES, CATEGORIAS, POR_PAGINA } from "./constantes";

/**
 * CENTRO DE EVIDENCIAS LEGALES (SuperSU, Fase 4). Cero confianza: aquí se exige SuperSU y las
 * funciones de la migración 149 lo vuelven a exigir en la base, recalculan las huellas y dejan cada
 * consulta y exportación en `evento_auditoria`. Los filtros del navegador se validan con zod.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso de SuperSU.",
  NO_ENCONTRADA: "No encontramos esa evidencia.",
  MOTIVO_REQUERIDO: "Escribe el motivo de la exportación (mínimo 10 caracteres).",
};

function traducir(m: string) {
  const clave = Object.keys(MENSAJES).find((k) => m.includes(k));
  return clave ? MENSAJES[clave] : "No pudimos completar la consulta. Intenta de nuevo.";
}

async function rpc<T>(nombre: string, args?: object): Promise<Resultado<T>> {
  await requireSuperSU();
  const supabase = (await createClient()) as unknown as RpcSinTipos;
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) return { ok: false, error: traducir(error.message) };
  return { ok: true, data: data as T };
}


const UUID = z.string().uuid();
const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const esquemaFiltros = z.object({
  correo: z.string().trim().max(254).optional(),
  usuario: UUID.optional(),
  negocio: UUID.optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  documento: z.string().trim().regex(/^[A-Z_]{2,60}$/).optional(),
  accion: z.enum(ACCIONES).optional(),
  desde: FECHA.optional(),
  hasta: FECHA.optional(),
  pagina: z.number().int().min(1).max(10000).default(1),
});

export type FiltrosEvidencias = z.input<typeof esquemaFiltros>;

export interface FilaEvidencia {
  id: string;
  secuencia: number;
  usuario_id: string | null;
  correo: string | null;
  rol: string;
  negocio_id: string | null;
  negocio: string | null;
  categoria: string;
  documento: string;
  accion: string;
  version: string | null;
  canal: string | null;
  finalidad: string | null;
  importado: boolean;
  ocurrido_at: string;
  registrado_at: string;
  relacionado_con: string | null;
  tiene_texto: boolean;
}

/** Fechas del filtro en hora de Colombia: `hasta` incluye el día completo. */
const inicioDia = (d: string) => `${d}T00:00:00-05:00`;
const finDia = (d: string) => new Date(new Date(`${d}T00:00:00-05:00`).getTime() + 86_400_000).toISOString();

export async function buscarEvidencias(filtros: FiltrosEvidencias): Promise<Resultado<{ total: number; filas: FilaEvidencia[] }>> {
  const f = esquemaFiltros.safeParse(filtros);
  if (!f.success) return { ok: false, error: "Revisa los filtros." };
  const v = f.data;
  return rpc("admin_buscar_evidencias", {
    p_correo: v.correo || null,
    p_usuario: v.usuario ?? null,
    p_negocio: v.negocio ?? null,
    p_categoria: v.categoria ?? null,
    p_documento: v.documento ?? null,
    p_accion: v.accion ?? null,
    p_desde: v.desde ? inicioDia(v.desde) : null,
    p_hasta: v.hasta ? finDia(v.hasta) : null,
    p_limite: POR_PAGINA,
    p_offset: (v.pagina - 1) * POR_PAGINA,
  });
}

export interface DetalleEvidencia extends Omit<FilaEvidencia, "tiene_texto"> {
  texto: string | null;
  texto_sha256: string | null;
  documento_id: string | null;
  sede_id: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  fuente_tabla: string | null;
  hash: string;
  hash_anterior: string | null;
  verificacion: { contenido_ok: boolean; texto_ok: boolean; enlace_ok: boolean };
}

export async function detalleEvidencia(id: string): Promise<Resultado<DetalleEvidencia>> {
  if (!UUID.safeParse(id).success) return { ok: false, error: MENSAJES.NO_ENCONTRADA };
  return rpc("admin_evidencia_detalle", { p_id: id });
}

/**
 * Expediente de un titular, listo para descargar. Se devuelve el JSON exacto y su SHA-256 (huella
 * del archivo) para que quien lo reciba compruebe que no cambió después de generarse.
 */
export async function exportarExpediente(usuarioId: string, motivo: string): Promise<Resultado<{ contenido: string; sha256: string; nombre: string }>> {
  if (!UUID.safeParse(usuarioId).success) return { ok: false, error: "Titular no válido." };
  const m = z.string().trim().min(10).max(500).safeParse(motivo);
  if (!m.success) return { ok: false, error: MENSAJES.MOTIVO_REQUERIDO };
  const res = await rpc<object>("admin_expediente_evidencias", { p_usuario: usuarioId, p_motivo: m.data });
  if (!res.ok) return res;
  const contenido = JSON.stringify(res.data, null, 2);
  const sha256 = createHash("sha256").update(contenido, "utf8").digest("hex");
  const fecha = new Date().toISOString().slice(0, 10);
  return { ok: true, data: { contenido, sha256, nombre: `expediente-${usuarioId.slice(0, 8)}-${fecha}.json` } };
}

export async function verificarCadena(): Promise<Resultado<{ total: number; verificado_at: string; problemas: { secuencia: number; problema: string }[] }>> {
  return rpc("admin_verificar_cadena_evidencias");
}
