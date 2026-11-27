"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { llamar, type Resultado } from "@/lib/ganancias/rpc";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Acciones del panel de ganancias. NINGUNA confía en datos del navegador para decidir a qué negocio se aplica: el negocio sale de la
 * sesión (resolverContexto) y la base vuelve a validar identidad, negocio, sede y capacidad en cada función (migración 201).
 */
type Estado = Resultado;

const uuid = z.string().uuid();
const opcUuid = z.preprocess((v) => (v === "" || v === null ? undefined : v), uuid.optional());
const opcFecha = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());
const texto = (min: number, max = 500) => z.string().trim().min(min).max(max);
const monto = z.coerce.number().finite().min(-100000000).max(100000000);

async function negocioDeSesion(): Promise<string | null> {
  const c = await resolverContexto();
  if (!c.userId || !c.negocioId) return null;
  if (c.rol !== "BARBERIA" && c.rol !== "ADMIN" && c.rol !== "GUARDIAN") return null;
  return c.negocioId;
}

function datos(fd: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(fd.entries());
}

async function ejecutar(fd: FormData, esquema: z.ZodType<Record<string, unknown>>, rpc: string, mapear: (d: Record<string, unknown>, negocio: string) => Record<string, unknown>): Promise<Estado> {
  const negocio = await negocioDeSesion();
  if (!negocio) return { ok: false, error: "No tienes acceso a este módulo." };
  const p = esquema.safeParse(datos(fd));
  if (!p.success) return { ok: false, error: "Revisa los datos del formulario." };
  const r = await llamar(rpc, mapear(p.data, negocio));
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/panel/ganancias");
  return { ok: true };
}

export async function crearRegla(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(
    fd,
    z.object({
      pct: z.coerce.number().min(0).max(100),
      base: z.enum(["PRECIO_ORIGINAL", "NETO"]),
      motivo: texto(3),
      sede: opcUuid, staff: opcUuid, servicio: opcUuid,
      categoria: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(40).optional()),
      desde: opcFecha, hasta: opcFecha, reemplaza: opcUuid,
    }),
    "comision_regla_crear",
    (d, n) => ({
      p_negocio: n, p_pct: d.pct, p_base: d.base, p_motivo: d.motivo, p_sede: d.sede ?? null, p_staff: d.staff ?? null,
      p_servicio: d.servicio ?? null, p_categoria: d.categoria ?? null, p_desde: d.desde ?? null, p_hasta: d.hasta ?? null, p_reemplaza: d.reemplaza ?? null,
    })
  );
}

export async function desactivarRegla(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(fd, z.object({ regla: uuid, motivo: texto(3) }), "comision_regla_desactivar", (d) => ({ p_regla: d.regla, p_motivo: d.motivo }));
}

export async function cerrarLiquidacion(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(
    fd,
    z.object({
      staff: uuid, sede: opcUuid, desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tipo: z.enum(["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL", "PERSONALIZADO"]),
    }),
    "liquidacion_cerrar",
    (d, n) => ({ p_negocio: n, p_staff: d.staff, p_sede: d.sede ?? null, p_tipo: d.tipo, p_desde: d.desde, p_hasta: d.hasta, p_ganancia_ids: null })
  );
}

export async function registrarPago(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(
    fd,
    z.object({
      liquidacion: uuid, monto: z.coerce.number().positive().max(100000000),
      medio: z.enum(["EFECTIVO", "TRANSFERENCIA", "NEQUI", "DAVIPLATA", "OTRO"]),
      referencia: z.string().trim().max(120).optional(), observacion: z.string().trim().max(500).optional(),
      fecha: opcFecha, clave: z.string().trim().max(80).optional(),
    }),
    "liquidacion_registrar_pago",
    (d) => ({
      p_liquidacion: d.liquidacion, p_monto: d.monto, p_medio: d.medio, p_referencia: d.referencia || null, p_observacion: d.observacion || null,
      p_evidencia_path: null, p_fecha: d.fecha ?? null, p_clave: d.clave || null,
    })
  );
}

export async function anularPago(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(fd, z.object({ pago: uuid, motivo: texto(10) }), "ganancia_pago_anular", (d) => ({ p_pago: d.pago, p_motivo: d.motivo }));
}

export async function revertirLiquidacion(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(fd, z.object({ liquidacion: uuid, motivo: texto(10) }), "liquidacion_revertir", (d) => ({ p_liquidacion: d.liquidacion, p_motivo: d.motivo }));
}

export async function ajustarComision(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(
    fd,
    z.object({ staff: uuid, monto: monto.refine((v) => v !== 0), motivo: texto(10) }),
    "ganancia_ajustar",
    (d, n) => ({ p_negocio: n, p_staff: d.staff, p_monto: d.monto, p_motivo: d.motivo, p_ganancia: null })
  );
}

export async function detectarNovedades(...args: [Estado | null, FormData]): Promise<Estado> {
  void args; // firma de useActionState; esta acción no usa datos del formulario
  const negocio = await negocioDeSesion();
  if (!negocio) return { ok: false, error: "No tienes acceso a este módulo." };
  const r = await llamar("ganancias_detectar_novedades", { p_negocio: negocio });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/panel/ganancias");
  return { ok: true };
}

export async function gestionarNovedad(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(
    fd,
    z.object({ novedad: uuid, estado: z.enum(["PENDIENTE", "EN_REVISION", "RESUELTA", "DESCARTADA"]), resolucion: z.string().trim().max(500).optional() }),
    "ganancia_novedad_gestionar",
    (d) => ({ p_novedad: d.novedad, p_estado: d.estado, p_resolucion: d.resolucion || null, p_asignado: null })
  );
}

export async function responderRevision(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(
    fd,
    z.object({ revision: uuid, estado: z.enum(["EN_REVISION", "EVIDENCIA_SOLICITADA", "APROBADA", "RECHAZADA"]), respuesta: texto(5) }),
    "revision_responder",
    (d) => ({ p_revision: d.revision, p_estado: d.estado, p_respuesta: d.respuesta })
  );
}

export async function definirPermiso(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(
    fd,
    z.object({ usuario: uuid, sede: opcUuid }).passthrough(),
    "ganancia_permiso_definir",
    (d, n) => {
      const marca = (k: string) => fd.get(k) === "on";
      return {
        p_negocio: n, p_usuario: d.usuario, p_sede: d.sede ?? null,
        p_caps: { ver: marca("ver"), configurar: marca("configurar"), liquidar: marca("liquidar"), pagar: marca("pagar"), exportar: marca("exportar"), novedades: marca("novedades") },
      };
    }
  );
}

export async function quitarPermiso(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(fd, z.object({ usuario: uuid }), "ganancia_permiso_quitar", (d, n) => ({ p_negocio: n, p_usuario: d.usuario }));
}

export async function solicitarSoporte(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(fd, z.object({ motivo: texto(10) }), "soporte_ganancias_solicitar", (d, n) => ({ p_negocio: n, p_motivo: d.motivo }));
}

export async function autorizarSoporte(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(fd, z.object({ acceso: uuid, minutos: z.coerce.number().int().min(5).max(240) }), "soporte_ganancias_autorizar", (d) => ({ p_acceso: d.acceso, p_duracion_min: d.minutos }));
}

export async function revocarSoporte(_: Estado | null, fd: FormData): Promise<Estado> {
  return ejecutar(fd, z.object({ acceso: uuid }), "soporte_ganancias_revocar", (d) => ({ p_acceso: d.acceso, p_motivo: "Cerrado por el propietario" }));
}
