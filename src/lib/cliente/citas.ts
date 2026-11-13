import "server-only";
import { procesarReembolsosSinFallar } from "@/lib/pagos/reembolsos";
import { llamarRpc, type Resultado } from "./base";

/** C03 Detalle de cita, C02 Calificar visita. Reprogramar/cancelar reutilizan los RPC del motor de reservas. */
export interface CitaDetalle {
  reserva_id: string;
  /** Código corto de ticket (6 caracteres), p. ej. «A3F9C1». */
  codigo: string;
  estado: "PENDIENTE_PAGO" | "CONFIRMADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA" | "NO_SHOW";
  hora_inicio: string;
  hora_fin: string;
  zona_horaria: string;
  servicios: { servicio_id: string; nombre: string; precio: number; duracion_minutos: number }[];
  staff: { staff_id: string; nombre: string; foto_url: string | null } | null;
  negocio: { negocio_id: string; nombre: string; slug: string; telefono: string | null; logo_url: string | null };
  sede: { sede_id: string; nombre: string; direccion: string | null; ciudad: string | null; latitud: number | null; longitud: number | null };
  monto_total: number;
  monto_sena: number;
  sena_pagada: number;
  /** «SALDO EN SILLA». */
  saldo_en_silla: number;
  /** «Cancela gratis hasta…» (ISO). */
  cancelacion_gratis_hasta: string;
  reprogramable_hasta: string;
  checkin_at: string | null;
  puede_cancelar: boolean;
  puede_reprogramar: boolean;
  /** Botón «LLEGUÉ» habilitado (desde 1 h antes hasta el fin de la cita). */
  puede_llegue: boolean;
  ya_califico: boolean;
  puede_calificar: boolean;
  chat_habilitado: boolean;
}

export function obtenerDetalleCita(reservaId: string): Promise<Resultado<CitaDetalle>> {
  return llamarRpc<CitaDetalle>("mi_cita_detalle", { p_reserva_id: reservaId });
}

/** «LLEGUÉ». Con coordenadas valida ≤ 0,5 km de la sede (FUERA_DEL_LOCAL). Devuelve la hora de check-in. */
export function marcarLlegada(reservaId: string, coords?: { lat: number; lng: number }): Promise<Resultado<string>> {
  return llamarRpc<string>("marcar_llegada", {
    p_reserva_id: reservaId,
    ...(coords ? { p_lat: coords.lat, p_lng: coords.lng } : {}),
  });
}

/**
 * Reprogramar SIN perder el anticipo: reutiliza `reprogramar_reserva` (valida slot real vía slots_disponibles,
 * ventana de reprogramación y que la cita siga CONFIRMADA). `nuevaHoraInicio` debe ser un slot devuelto por
 * `slots_disponibles` (ISO con zona).
 */
export function reprogramarCita(reservaId: string, nuevaHoraInicio: string, motivo?: string): Promise<Resultado<{ id: string; hora_inicio: string; hora_fin: string; estado: string }>> {
  return llamarRpc("reprogramar_reserva", {
    p_reserva_id: reservaId,
    p_nueva_hora_inicio: nuevaHoraInicio,
    ...(motivo ? { p_motivo: motivo } : {}),
  });
}

export interface ResultadoCancelacion {
  reserva_id: string;
  pago_id: string | null;
  reembolso_pct: number;
  reembolso_monto: number;
  motivo_catalogo: string | null;
}

/**
 * Cancelar cita con la política que el cliente aceptó al reservar. La RPC encola el
 * reembolso (tabla `reembolso`); aquí se dispara el worker, que solo lo da por hecho
 * cuando la pasarela lo confirma.
 */
export async function cancelarCita(reservaId: string, motivo?: string): Promise<Resultado<ResultadoCancelacion>> {
  const r = await llamarRpc<ResultadoCancelacion>("cancelar_reserva", {
    p_reserva_id: reservaId,
    ...(motivo ? { p_motivo: motivo } : {}),
  });
  if (r.ok) await procesarReembolsosSinFallar();
  return r;
}

export interface ResenaCreada {
  id: string;
  reserva_id: string;
  calificacion: number;
  comentario: string | null;
  created_at: string;
}

/**
 * C02 Publicar reseña (1–5, comentario opcional ≤ 500). Solo citas COMPLETADA propias, dentro de 30 días,
 * una por cita. negocio y profesional salen de la reserva. NOTA: las fotos de reseña no están soportadas.
 */
export function calificarVisita(reservaId: string, calificacion: number, comentario?: string): Promise<Resultado<ResenaCreada>> {
  return llamarRpc<ResenaCreada>("calificar_visita", {
    p_reserva_id: reservaId,
    p_calificacion: calificacion,
    ...(comentario ? { p_comentario: comentario } : {}),
  });
}
