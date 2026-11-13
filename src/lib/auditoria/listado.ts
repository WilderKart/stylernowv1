import { z } from "zod";

/** Tipos y validación compartidos por /admin/auditoria y /panel/auditoria (RPC `auditoria_listar`, migración 123). */

export const POR_PAGINA = 50;

/** Forma de un uuid (sin exigir versión: los ids de semilla no son v4). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las fechas del filtro son días calendario en hora de Colombia (UTC-5, sin horario de verano). */
export function rangoFechas(desde?: string, hasta?: string): { p_desde: string | null; p_hasta: string | null } {
  return {
    p_desde: desde ? new Date(`${desde}T00:00:00-05:00`).toISOString() : null,
    p_hasta: hasta ? new Date(Date.parse(`${hasta}T00:00:00-05:00`) + 86_400_000).toISOString() : null,
  };
}

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)))
  .optional()
  .or(z.literal("").transform(() => undefined));

export const esquemaFiltros = z.object({
  entidad: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,60}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  accion: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  desde: fecha,
  hasta: fecha,
  pagina: z.number().int().min(1).max(2000).default(1),
});

export type FiltrosAuditoria = z.input<typeof esquemaFiltros>;

export interface FilaAuditoria {
  id: string;
  created_at: string;
  entidad_tipo: string;
  entidad_id: string | null;
  accion: string;
  actor_tipo: string;
  actor_nombre: string | null;
  negocio_id: string | null;
  negocio_nombre: string | null;
  motivo: string | null;
  origen: string | null;
  request_id: string | null;
  payload_antes: unknown;
  payload_despues: unknown;
}

export interface EventoAuditoriaDetalle {
  id: string;
  createdAt: string;
  entidadTipo: string;
  entidadId: string | null;
  accion: string;
  actorTipo: string;
  actorNombre: string | null;
  negocioId: string | null;
  negocioNombre: string | null;
  motivo: string | null;
  origen: string | null;
  requestId: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

export interface PaginaAuditoria {
  eventos: EventoAuditoriaDetalle[];
  pagina: number;
  hayMas: boolean;
}

function comoObjeto(v: unknown): Record<string, unknown> | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return { valor: v };
}

export function aEvento(f: FilaAuditoria): EventoAuditoriaDetalle {
  return {
    id: f.id,
    createdAt: f.created_at,
    entidadTipo: f.entidad_tipo,
    entidadId: f.entidad_id,
    accion: f.accion,
    actorTipo: f.actor_tipo,
    actorNombre: f.actor_nombre,
    negocioId: f.negocio_id,
    negocioNombre: f.negocio_nombre,
    motivo: f.motivo,
    origen: f.origen,
    requestId: f.request_id,
    antes: comoObjeto(f.payload_antes),
    despues: comoObjeto(f.payload_despues),
  };
}

export interface CambioCampo {
  campo: string;
  antes: string;
  despues: string;
}

function texto(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "vacío";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/**
 * Diferencia campo a campo entre antes y después. Si solo hay "después" (creación) o solo "antes"
 * (eliminación), lista todos los campos del lado que existe.
 */
export function diferencias(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null): CambioCampo[] {
  const claves = Array.from(new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])).sort();
  const cambios: CambioCampo[] = [];
  for (const c of claves) {
    const a = antes ? antes[c] : undefined;
    const d = despues ? despues[c] : undefined;
    if (antes && despues && JSON.stringify(a) === JSON.stringify(d)) continue;
    cambios.push({ campo: c, antes: antes ? texto(a) : "—", despues: despues ? texto(d) : "—" });
  }
  return cambios;
}
