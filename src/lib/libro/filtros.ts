import { z } from "zod";

/**
 * Libro financiero (migración 122): filtros, etiquetas y CSV. Lógica pura (sin servidor), probada en
 * tests/libro.test.ts. Los filtros llegan del navegador: se validan aquí y la RLS decide qué filas
 * puede ver cada quien; ningún filtro amplía el acceso.
 */

export const CATEGORIAS = [
  "RESERVA",
  "ANTICIPO",
  "PAGO_SERVICIO",
  "PROPINA",
  "GIFT_CARD",
  "REDENCION_GIFT_CARD",
  "MEMBRESIA",
  "VENTA_LOCAL",
  "REEMBOLSO",
  "COMISION_PLATAFORMA",
  "PAGO_A_STYLERNOW",
  "INGRESO_PLATAFORMA",
  "AJUSTE",
] as const;
export const ESTADOS = ["PENDIENTE", "CONFIRMADO", "FALLIDO", "REQUIERE_REVISION", "INFORMATIVO"] as const;
export const ENTIDADES = ["NEGOCIO", "PLATAFORMA"] as const;

export type Categoria = (typeof CATEGORIAS)[number];
export type EstadoLibro = (typeof ESTADOS)[number];

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  RESERVA: "Reserva",
  ANTICIPO: "Anticipo",
  PAGO_SERVICIO: "Pago de servicio",
  PROPINA: "Propina",
  GIFT_CARD: "Gift card",
  REDENCION_GIFT_CARD: "Uso de gift card",
  MEMBRESIA: "Membresía",
  VENTA_LOCAL: "Venta en el local",
  REEMBOLSO: "Reembolso",
  COMISION_PLATAFORMA: "Comisión StylerNow",
  PAGO_A_STYLERNOW: "Pago a StylerNow",
  INGRESO_PLATAFORMA: "Ingreso StylerNow",
  AJUSTE: "Ajuste",
};

export const ETIQUETA_ESTADO: Record<EstadoLibro, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  FALLIDO: "Fallido",
  REQUIERE_REVISION: "En revisión",
  INFORMATIVO: "Informativo",
};

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const esquemaFiltros = z.object({
  desde: fecha,
  hasta: fecha,
  categoria: z.enum(CATEGORIAS).optional().or(z.literal("").transform(() => undefined)),
  estado: z.enum(ESTADOS).optional().or(z.literal("").transform(() => undefined)),
  entidad: z.enum(ENTIDADES).optional().or(z.literal("").transform(() => undefined)),
  /** Referencia: id de pago, reserva o reembolso, o id externo del proveedor. */
  referencia: z
    .string()
    .trim()
    .max(80)
    .regex(/^[A-Za-z0-9-]*$/)
    .optional(),
  /** Solo Super Admin; para un negocio se ignora y se usa el de su sesión. */
  negocioId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type FiltrosLibro = z.output<typeof esquemaFiltros>;

/** Lee filtros de un objeto de searchParams; si algo es inválido, se descarta (nunca amplía el acceso). */
export function leerFiltros(params: Record<string, string | string[] | undefined>): FiltrosLibro {
  const plano = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const r = esquemaFiltros.safeParse(plano);
  return r.success ? r.data : esquemaFiltros.parse({});
}

/** Rango [desde, hasta+1día) en ISO; las fechas se interpretan en hora de Colombia (UTC−5). */
export function rangoFechas(f: Pick<FiltrosLibro, "desde" | "hasta">) {
  const desde = f.desde ? new Date(`${f.desde}T00:00:00-05:00`).toISOString() : null;
  const hasta = f.hasta ? new Date(new Date(`${f.hasta}T00:00:00-05:00`).getTime() + 86_400_000).toISOString() : null;
  return { desde, hasta };
}

export interface MovimientoLibro {
  id: string;
  entidad: "NEGOCIO" | "PLATAFORMA";
  negocio_id: string | null;
  categoria: Categoria;
  evento: string;
  sentido: "INGRESO" | "EGRESO" | "INFORMATIVO";
  estado: EstadoLibro;
  monto: number;
  moneda: string;
  ocurrido_at: string;
  registrado_at: string;
  referencia_tipo: string;
  referencia_id: string;
  pago_id: string | null;
  reembolso_id: string | null;
  reserva_id: string | null;
  proveedor: string | null;
  id_externo: string | null;
  cuenta_recaudo: string | null;
  actor_tipo: string;
  ajusta_movimiento_id: string | null;
  motivo: string | null;
}

export const COLUMNAS_LIBRO =
  "id, entidad, negocio_id, categoria, evento, sentido, estado, monto, moneda, ocurrido_at, registrado_at, referencia_tipo, referencia_id, pago_id, reembolso_id, reserva_id, proveedor, id_externo, cuenta_recaudo, actor_tipo, ajusta_movimiento_id, motivo";

/**
 * Celda CSV segura: comillas escapadas y neutralización de inyección de fórmulas (una celda que
 * empieza por = + - @ tab o retorno se abriría como fórmula en Excel/Sheets).
 */
export function celdaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  let s = typeof valor === "number" ? String(valor) : String(valor);
  if (typeof valor !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

export const ENCABEZADOS_EXPORTACION: [keyof MovimientoLibro, string][] = [
  ["ocurrido_at", "Fecha"],
  ["entidad", "Entidad"],
  ["negocio_id", "Negocio"],
  ["categoria", "Categoría"],
  ["evento", "Evento"],
  ["sentido", "Sentido"],
  ["estado", "Estado"],
  ["monto", "Monto"],
  ["moneda", "Moneda"],
  ["proveedor", "Proveedor"],
  ["id_externo", "Id externo"],
  ["referencia_tipo", "Referencia"],
  ["referencia_id", "Id referencia"],
  ["pago_id", "Pago"],
  ["reembolso_id", "Reembolso"],
  ["reserva_id", "Reserva"],
  ["ajusta_movimiento_id", "Ajusta a"],
  ["motivo", "Motivo"],
  ["actor_tipo", "Origen"],
  ["id", "Id movimiento"],
];

export function aCsv(filas: MovimientoLibro[]): string {
  const cabecera = ENCABEZADOS_EXPORTACION.map(([, t]) => celdaCsv(t)).join(",");
  const cuerpo = filas.map((f) => ENCABEZADOS_EXPORTACION.map(([k]) => celdaCsv(f[k])).join(","));
  // BOM para que Excel abra el UTF-8 con tildes correctamente.
  return "﻿" + [cabecera, ...cuerpo].join("\r\n") + "\r\n";
}

export interface TotalLibro {
  periodo: string;
  entidad: string;
  categoria: Categoria;
  sentido: "INGRESO" | "EGRESO" | "INFORMATIVO";
  estado: EstadoLibro;
  moneda: string;
  cantidad: number;
  total: number;
}

/** Resumen económico: solo hechos CONFIRMADOS con sentido INGRESO/EGRESO. No es un saldo disponible. */
export function resumenEconomico(totales: TotalLibro[]) {
  const porMoneda = new Map<string, { ingresos: number; egresos: number }>();
  for (const t of totales) {
    if (t.estado !== "CONFIRMADO" || t.sentido === "INFORMATIVO") continue;
    const m = porMoneda.get(t.moneda) ?? { ingresos: 0, egresos: 0 };
    if (t.sentido === "INGRESO") m.ingresos += Number(t.total);
    else m.egresos += Number(t.total);
    porMoneda.set(t.moneda, m);
  }
  return [...porMoneda.entries()].map(([moneda, v]) => ({ moneda, ...v, neto: v.ingresos - v.egresos }));
}
