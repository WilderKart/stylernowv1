import {
  VARIABLES_CAMPANA,
  VARIABLES_PLANTILLA,
  type Categoria,
  type EstadoCampana,
  type EstadoCompra,
  type EstadoConexion,
  type EstadoMensaje,
  type EstadoPlantilla,
  type Segmento,
} from "./tipos";

/**
 * Logica pura del modulo de WhatsApp. Es un ESPEJO de la migracion 120 para mostrar en pantalla lo mismo que
 * decide la base: la autoridad real son las funciones SQL. Si cambias una regla aqui, cambiala tambien alla
 * (las pruebas de tests/whatsapp.test.ts fijan el comportamiento esperado).
 */

type Mapa<E extends string> = Readonly<Record<E, readonly E[]>>;

const PLANTILLA: Mapa<EstadoPlantilla> = {
  BORRADOR: ["PENDIENTE_APROBACION"],
  PENDIENTE_APROBACION: ["APROBADA", "RECHAZADA"],
  APROBADA: ["RECHAZADA"],
  RECHAZADA: ["BORRADOR"],
};

const CAMPANA: Mapa<EstadoCampana> = {
  BORRADOR: ["PROGRAMADA", "BLOQUEADA_SIN_CONEXION", "CANCELADA"],
  PROGRAMADA: ["EN_ENVIO", "BLOQUEADA_SIN_CONEXION", "CANCELADA"],
  BLOQUEADA_SIN_CONEXION: ["PROGRAMADA", "CANCELADA"],
  EN_ENVIO: ["COMPLETADA", "BLOQUEADA_SIN_CONEXION"],
  COMPLETADA: [],
  CANCELADA: [],
};

const MENSAJE: Mapa<EstadoMensaje> = {
  PREPARADO: ["ENVIADO", "FALLIDO", "BLOQUEADO_SIN_CONEXION"],
  BLOQUEADO_SIN_CONEXION: ["PREPARADO", "FALLIDO"],
  ENVIADO: ["ENTREGADO", "LEIDO", "FALLIDO"],
  ENTREGADO: ["LEIDO"],
  LEIDO: [],
  FALLIDO: [],
};

const COMPRA: Mapa<EstadoCompra> = {
  PENDIENTE_PAGO: ["ACREDITADA", "CANCELADA"],
  ACREDITADA: [],
  CANCELADA: [],
};

const CONEXION: Mapa<EstadoConexion> = {
  NO_CONFIGURADO: ["PENDIENTE_CREDENCIALES"],
  PENDIENTE_CREDENCIALES: ["NO_CONFIGURADO", "SANDBOX", "PRODUCCION", "ERROR"],
  SANDBOX: ["PRODUCCION", "ERROR", "SUSPENDIDO", "REVOCADO"],
  PRODUCCION: ["ERROR", "SUSPENDIDO", "REVOCADO"],
  SUSPENDIDO: ["PRODUCCION", "REVOCADO"],
  ERROR: ["PENDIENTE_CREDENCIALES", "NO_CONFIGURADO", "PRODUCCION"],
  REVOCADO: ["PENDIENTE_CREDENCIALES", "NO_CONFIGURADO"],
};

export const TRANSICIONES = { PLANTILLA, CAMPANA, MENSAJE, COMPRA, CONEXION } as const;
export type Maquina = keyof typeof TRANSICIONES;

export function transicionValida(maquina: Maquina, desde: string, hacia: string): boolean {
  const mapa = TRANSICIONES[maquina] as Readonly<Record<string, readonly string[]>>;
  return (mapa[desde] ?? []).includes(hacia);
}

/** Solo con PRODUCCION se puede enviar. Cualquier otro estado bloquea el envio. */
export function envioHabilitado(estado: EstadoConexion): boolean {
  return estado === "PRODUCCION";
}

/** Tope de marketing de un lote: floor(cantidad * pct / 100), con aritmetica entera (igual que numeric en SQL). */
export function cupoMarketing(cantidad: number, pct: number): number {
  if (!Number.isFinite(cantidad) || !Number.isFinite(pct) || cantidad <= 0 || pct <= 0) return 0;
  const pctCentesimas = Math.round(Math.min(pct, 100) * 100);
  return Math.floor((Math.trunc(cantidad) * pctCentesimas) / 10000);
}

export interface LoteSimulado {
  id: string;
  origen: "PLAN" | "PAQUETE";
  disponible: number;
  cupoMarketing: number;
  marketingConsumido: number;
  otorgado: Date;
  vence: Date;
}

export function loteVigente(l: LoteSimulado, ahora: Date): boolean {
  return l.otorgado.getTime() <= ahora.getTime() && l.vence.getTime() > ahora.getTime();
}

/** Primero el lote del plan; luego recargas por vencimiento (FIFO) y fecha de otorgamiento. */
export function ordenarLotesParaConsumo(lotes: LoteSimulado[]): LoteSimulado[] {
  return [...lotes].sort(
    (a, b) =>
      Number(a.origen !== "PLAN") - Number(b.origen !== "PLAN") ||
      a.vence.getTime() - b.vence.getTime() ||
      a.otorgado.getTime() - b.otorgado.getTime()
  );
}

/** Lote del que saldria la siguiente conversacion (null = sin saldo / sin cupo de marketing). */
export function elegirLote(lotes: LoteSimulado[], categoria: Categoria, ahora: Date): LoteSimulado | null {
  return (
    ordenarLotesParaConsumo(lotes).find(
      (l) => loteVigente(l, ahora) && l.disponible > 0 && (categoria === "UTILIDAD" || l.marketingConsumido < l.cupoMarketing)
    ) ?? null
  );
}

/** Aplica un consumo (devuelve lotes nuevos). Lanza el mismo codigo que la base si no hay saldo. */
export function consumir(lotes: LoteSimulado[], categoria: Categoria, ahora: Date): { lotes: LoteSimulado[]; loteId: string } {
  const lote = elegirLote(lotes, categoria, ahora);
  if (!lote) throw new Error(categoria === "MARKETING" ? "CUPO_MARKETING_AGOTADO" : "SALDO_INSUFICIENTE");
  return {
    loteId: lote.id,
    lotes: lotes.map((l) =>
      l.id === lote.id
        ? { ...l, disponible: l.disponible - 1, marketingConsumido: l.marketingConsumido + (categoria === "MARKETING" ? 1 : 0) }
        : l
    ),
  };
}

export function saldoDisponible(lotes: LoteSimulado[], ahora: Date): { total: number; marketing: number } {
  const vigentes = lotes.filter((l) => loteVigente(l, ahora));
  return {
    total: vigentes.reduce((s, l) => s + l.disponible, 0),
    marketing: vigentes.reduce((s, l) => s + Math.max(0, Math.min(l.cupoMarketing - l.marketingConsumido, l.disponible)), 0),
  };
}

/** Porcentaje consumido de la cuota del plan (0-100, dos decimales). */
export function pctConsumido(cuota: number, disponible: number): number {
  if (!cuota || cuota <= 0) return 0;
  const usado = Math.min(Math.max(cuota - disponible, 0), cuota);
  return Math.round((usado * 10000) / cuota) / 100;
}

export function umbralesAlcanzados(pct: number, umbrales: number[]): number[] {
  return [...new Set(umbrales)].filter((u) => u <= pct).sort((a, b) => a - b);
}

/** Vencimiento de una recarga: fecha de acreditacion + N meses (mismo criterio que make_interval(months => n)). */
export function vencimientoRecarga(acreditada: Date, meses: number): Date {
  const d = new Date(acreditada.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimoDia));
  return d;
}

/** Valida cuerpo y variables como _whatsapp_validar_plantilla. Devuelve el codigo de error o null. */
export function validarPlantilla(cuerpo: string, variables: readonly string[]): string | null {
  if (!cuerpo || cuerpo.trim().length === 0 || cuerpo.length > 1024) return "CUERPO_INVALIDO";
  if (variables.length > 10) return "VARIABLES_INVALIDAS";
  if (variables.some((v) => !(VARIABLES_PLANTILLA as readonly string[]).includes(v))) return "VARIABLE_DESCONOCIDA";
  if (new Set(variables).size !== variables.length) return "VARIABLE_DUPLICADA";
  const marcadores = [...new Set([...cuerpo.matchAll(/\{\{\s*([0-9]{1,2})\s*\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  const esperados = variables.map((_, i) => i + 1);
  if (marcadores.length !== esperados.length || marcadores.some((m, i) => m !== esperados[i])) return "MARCADORES_NO_COINCIDEN";
  return null;
}

export function variablesUsablesEnCampana(variables: readonly string[]): boolean {
  return variables.every((v) => (VARIABLES_CAMPANA as readonly string[]).includes(v));
}

const CLAVES_SEGMENTO = ["dias_sin_visita_min", "visitas_min", "etiqueta"];

export function validarSegmento(seg: unknown): string | null {
  if (!seg || typeof seg !== "object" || Array.isArray(seg)) return "SEGMENTO_INVALIDO";
  const s = seg as Record<string, unknown>;
  if (Object.keys(s).some((k) => !CLAVES_SEGMENTO.includes(k))) return "SEGMENTO_INVALIDO";
  const entero = (v: unknown, min: number, max: number) => v === null || v === undefined || (Number.isInteger(v) && (v as number) >= min && (v as number) <= max);
  if (!entero(s.dias_sin_visita_min, 1, 3650) || !entero(s.visitas_min, 1, 1000)) return "SEGMENTO_INVALIDO";
  if (s.etiqueta !== null && s.etiqueta !== undefined && (typeof s.etiqueta !== "string" || s.etiqueta.trim().length < 1 || s.etiqueta.trim().length > 50)) {
    return "SEGMENTO_INVALIDO";
  }
  return null;
}

/** Limpia el segmento quitando claves vacias (lo que se envia a la base). */
export function normalizarSegmento(seg: Segmento): Segmento {
  const out: Segmento = {};
  if (seg.dias_sin_visita_min) out.dias_sin_visita_min = seg.dias_sin_visita_min;
  if (seg.visitas_min) out.visitas_min = seg.visitas_min;
  if (seg.etiqueta && seg.etiqueta.trim()) out.etiqueta = seg.etiqueta.trim();
  return out;
}

/** Resultado de programar una campana, en el mismo orden de chequeos que whatsapp_campana_programar. */
export function resultadoProgramacion(p: {
  destinatarios: number;
  marketingDisponible: number;
  conexion: EstadoConexion;
  plantilla: EstadoPlantilla;
}): "SIN_DESTINATARIOS" | "CUPO_MARKETING_INSUFICIENTE" | "BLOQUEADA_SIN_CONEXION" | "PLANTILLA_NO_APROBADA" | "PROGRAMADA" {
  if (p.destinatarios <= 0) return "SIN_DESTINATARIOS";
  if (p.destinatarios > p.marketingDisponible) return "CUPO_MARKETING_INSUFICIENTE";
  if (!envioHabilitado(p.conexion)) return "BLOQUEADA_SIN_CONEXION";
  if (p.plantilla !== "APROBADA") return "PLANTILLA_NO_APROBADA";
  return "PROGRAMADA";
}
