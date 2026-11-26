import { z } from "zod";

export const TAMANO_PAGINA = 25;

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();
const opc = <T extends z.ZodTypeAny>(s: T) => s.optional().catch(undefined);

export interface FiltrosGanancias {
  desde?: string;
  hasta?: string;
  sede?: string;
  staff?: string;
  servicio?: string;
  categoria?: string;
  estadoComision?: string;
  estadoCobro?: string;
  estadoLiquidacion?: string;
  q?: string;
  rapido?: string;
  pagina: number;
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Rangos rápidos calculados desde la fecha de HOY (AAAA-MM-DD, zona del negocio). */
export function rangoRapido(clave: string, hoy: string): { desde: string; hasta: string } | null {
  const d = new Date(`${hoy}T12:00:00Z`);
  const diaSemana = (d.getUTCDay() + 6) % 7; // lunes = 0
  const inicioSemana = sumarDias(hoy, -diaSemana);
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  switch (clave) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "ayer":
      return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) };
    case "semana":
      return { desde: inicioSemana, hasta: hoy };
    case "semana_anterior":
      return { desde: sumarDias(inicioSemana, -7), hasta: sumarDias(inicioSemana, -1) };
    case "mes":
      return { desde: inicioMes, hasta: hoy };
    case "mes_anterior": {
      const finAnterior = sumarDias(inicioMes, -1);
      return { desde: `${finAnterior.slice(0, 7)}-01`, hasta: finAnterior };
    }
    default:
      return null;
  }
}

export function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** Lee y VALIDA los filtros de la URL: lo que no cumple el formato se ignora (nunca llega a la base). */
export function leerFiltros(sp: Record<string, string | string[] | undefined>, hoy: string = hoyBogota()): FiltrosGanancias {
  const v = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]);
  const esquema = z.object({
    desde: opc(fecha),
    hasta: opc(fecha),
    sede: opc(uuid),
    staff: opc(uuid),
    servicio: opc(uuid),
    categoria: opc(z.string().max(40)),
    estadoComision: opc(z.enum(["SIN_REGLA", "PENDIENTE", "EN_REVISION", "LIQUIDADA", "REVERTIDA"])),
    estadoCobro: opc(z.enum(["SIN_COBRO", "PENDIENTE", "PARCIAL", "PAGADO", "CUBIERTO_MEMBRESIA", "REEMBOLSO_PARCIAL", "REEMBOLSO_TOTAL"])),
    estadoLiquidacion: opc(z.enum(["SIN_LIQUIDAR", "LIQUIDADA", "PAGADA"])),
    q: opc(z.string().trim().max(80)),
    rapido: opc(z.enum(["hoy", "ayer", "semana", "semana_anterior", "mes", "mes_anterior"])),
    pagina: z.coerce.number().int().min(1).max(10000).catch(1),
  });
  const f = esquema.parse({
    desde: v("desde"),
    hasta: v("hasta"),
    sede: v("sede"),
    staff: v("staff"),
    servicio: v("servicio"),
    categoria: v("categoria"),
    estadoComision: v("estado_comision"),
    estadoCobro: v("estado_cobro"),
    estadoLiquidacion: v("estado_liquidacion"),
    q: v("q") || undefined,
    rapido: v("rapido"),
    pagina: v("pagina") ?? 1,
  });
  if (f.rapido) {
    const r = rangoRapido(f.rapido, hoy);
    if (r) return { ...f, desde: r.desde, hasta: r.hasta };
  }
  return f;
}

/** Argumentos de ganancias_listar a partir de los filtros. */
export function argumentosListar(f: FiltrosGanancias, negocioId: string | null, limite = TAMANO_PAGINA) {
  return {
    p_negocio: negocioId,
    p_sede: f.sede ?? null,
    p_staff: f.staff ?? null,
    p_desde: f.desde ?? null,
    p_hasta: f.hasta ?? null,
    p_servicio: f.servicio ?? null,
    p_categoria: f.categoria ?? null,
    p_estado_comision: f.estadoComision ?? null,
    p_estado_cobro: f.estadoCobro ?? null,
    p_estado_liquidacion: f.estadoLiquidacion ?? null,
    p_busqueda: f.q ?? null,
    p_limite: limite,
    p_desplazamiento: (f.pagina - 1) * limite,
  };
}
