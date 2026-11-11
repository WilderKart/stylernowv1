import "server-only";
import { createClient } from "@/lib/supabase/server";
import { llamarRpc, type Resultado } from "./base";

/** C07 My Look, C08 Pagos y saldo, C09 Referidos. */

// ---------- C07 My Look ----------
export interface FotoMyLook {
  foto_id: string;
  reserva_id: string;
  /** Ruta en el bucket privado crm-fotos. */
  url: string;
  /** URL firmada (1 h) lista para <img>; null si no se pudo firmar. */
  url_firmada: string | null;
  momento: "ANTES" | "DESPUES" | null;
  /** Si el cliente la compartió en el portafolio público del profesional. */
  compartida: boolean;
  hora_inicio: string;
  staff_nombre: string | null;
  negocio_nombre: string;
  servicios: string | null;
}

/** Fotos propias (solo el cliente; el negocio las sube tras la cita con consentimiento). Una fila por foto: agrupa por reserva_id. */
export async function listarMyLook(limite = 60): Promise<Resultado<FotoMyLook[]>> {
  const r = await llamarRpc<Omit<FotoMyLook, "url_firmada">[]>("mi_look_listar", { p_limite: limite });
  if (!r.ok) return r;
  const supabase = await createClient();
  const data = await Promise.all(
    r.data.map(async (f) => {
      const { data: s } = await supabase.storage.from("crm-fotos").createSignedUrl(f.url, 3600);
      return { ...f, url_firmada: s?.signedUrl ?? null };
    })
  );
  return { ok: true, data };
}

/** «COMPARTIR»: publica/retira la foto del portafolio del profesional. */
export function compartirFotoMyLook(fotoId: string, compartir: boolean): Promise<Resultado<boolean>> {
  return llamarRpc<boolean>("mi_look_compartir", { p_foto_id: fotoId, p_compartir: compartir });
}

// ---------- C08 Pagos y saldo ----------
export interface Saldo {
  saldo: number;
  /** ISO 4217 según el país del perfil (COP por defecto). */
  moneda: string;
  /** Monto con devolución en curso, si hay. */
  devolucion_pendiente: number | null;
}
export const obtenerSaldo = (): Promise<Resultado<Saldo>> => llamarRpc<Saldo>("mi_saldo");

export interface MovimientoPago {
  fecha: string;
  categoria: "PAGO" | "SALDO";
  /** ANTICIPO | SALDO_EN_SILLA | PROPINA | (tipo de movimiento de saldo: REFERIDO, CASHBACK, CANJE…). */
  concepto: string;
  negocio_nombre: string | null;
  /** Con signo: pagos negativos, saldo a favor positivo. */
  monto: number;
  /** PAGADO | EN_PROCESO | REEMBOLSADO | RECHAZADO | EN_DISPUTA | A_SALDO */
  estado: string;
  referencia_id: string;
}
export const listarPagos = (filtro: "TODO" | "PAGOS" | "SALDO" = "TODO", limite = 50): Promise<Resultado<MovimientoPago[]>> =>
  llamarRpc<MovimientoPago[]>("mis_pagos", { p_filtro: filtro, p_limite: limite });

/** «PEDIR DEVOLUCIÓN»: crea una solicitud PENDIENTE (no mueve dinero). Sin monto = todo el saldo. */
export function solicitarDevolucionSaldo(monto?: number): Promise<Resultado<{ id: string; monto: number; estado: string }>> {
  return llamarRpc("solicitar_devolucion_saldo", monto != null ? { p_monto: monto } : {});
}
/** Los medios de pago guardados NO existen en la BD (los tokeniza la pasarela): no hay API para ellos. */
export const MEDIOS_DE_PAGO_SOPORTADOS = false;

// ---------- C09 Referidos ----------
export interface ResumenReferidos {
  codigo: string;
  invitados: number;
  con_cita: number;
  ganado: number;
  lista: {
    referido_id: string;
    /** «Diego M.» o «Cliente anónimo». */
    nombre: string;
    /** CITA_HECHA | REGISTRADO | EXPIRADO */
    estado: string;
    se_unio_at: string;
    completado_at: string | null;
    monto_recompensa: number | null;
  }[];
}
export const obtenerReferidos = (): Promise<Resultado<ResumenReferidos>> => llamarRpc<ResumenReferidos>("mis_referidos_detalle");
