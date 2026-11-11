"use server";

import { obtenerSlots } from "@/app/negocio/[slug]/reservar/actions";
import {
  calificarVisita,
  marcarLlegada,
  obtenerDetalleCita,
  reprogramarCita,
} from "@/lib/cliente/citas";
import { enviarMensaje, listarMensajes, marcarChatLeido, type MensajeChat } from "@/lib/cliente/chat";
import { revalidatePath } from "next/cache";

/**
 * Server actions de C02/C03/C04. Ninguna recibe sede, servicios, profesional ni rol del navegador:
 * todo se deriva de la cita (mi_cita_detalle valida auth.uid()) y las RPC vuelven a validar.
 */

export type Res<T = null> = { ok: true; data: T } | { ok: false; error: string; codigo: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ERR_GENERICO = "Algo salió mal. Inténtalo de nuevo.";

export async function llegueAction(reservaId: string, coords?: { lat: number; lng: number }): Promise<Res<string>> {
  const limpio =
    coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng) && Math.abs(coords.lat) <= 90 && Math.abs(coords.lng) <= 180
      ? coords
      : undefined;
  const r = await marcarLlegada(reservaId, limpio);
  if (r.ok) revalidatePath(`/reserva/${reservaId}`);
  return r;
}

export interface SlotLibre {
  hora_inicio: string;
}

/** Horarios reales (slots_disponibles) de la misma sede, servicios y profesional de la cita. */
export async function slotsReprogramarAction(reservaId: string, fecha: string): Promise<Res<SlotLibre[]>> {
  if (!FECHA.test(fecha)) return { ok: false, codigo: "ERROR", error: ERR_GENERICO };
  const d = await obtenerDetalleCita(reservaId);
  if (!d.ok) return d;
  if (!d.data.puede_reprogramar) {
    return { ok: false, codigo: "RESERVA_NO_REPROGRAMABLE", error: "Esta cita ya no se puede reprogramar." };
  }
  try {
    const slots = await obtenerSlots({
      sedeId: d.data.sede.sede_id,
      servicioIds: d.data.servicios.map((s) => s.servicio_id),
      fecha,
      staffId: d.data.staff?.staff_id ?? null,
    });
    const vistos = new Set<string>();
    const libres: SlotLibre[] = [];
    for (const s of slots) {
      if (!s.disponible || vistos.has(s.hora_inicio)) continue;
      if (new Date(s.hora_inicio).getTime() <= Date.now()) continue;
      vistos.add(s.hora_inicio);
      libres.push({ hora_inicio: s.hora_inicio });
    }
    return { ok: true, data: libres };
  } catch {
    return { ok: false, codigo: "ERROR", error: ERR_GENERICO };
  }
}

export async function reprogramarAction(reservaId: string, horaISO: string, motivo?: string): Promise<Res> {
  if (Number.isNaN(new Date(horaISO).getTime())) return { ok: false, codigo: "ERROR", error: ERR_GENERICO };
  const r = await reprogramarCita(reservaId, horaISO, motivo?.trim().slice(0, 200) || undefined);
  if (!r.ok) return r;
  revalidatePath(`/reserva/${reservaId}`);
  revalidatePath("/mis-reservas");
  return { ok: true, data: null };
}

export async function calificarAction(reservaId: string, calificacion: number, comentario: string): Promise<Res> {
  if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
    return { ok: false, codigo: "CALIFICACION_INVALIDA", error: "La calificación debe ser de 1 a 5." };
  }
  const r = await calificarVisita(reservaId, calificacion, comentario.trim() || undefined);
  if (!r.ok) return r;
  revalidatePath(`/reserva/${reservaId}`);
  revalidatePath("/mis-reservas");
  return { ok: true, data: null };
}

export async function enviarMensajeAction(reservaId: string, cuerpo: string): Promise<Res<MensajeChat>> {
  return enviarMensaje(reservaId, cuerpo);
}

export async function listarMensajesAction(reservaId: string): Promise<Res<MensajeChat[]>> {
  return listarMensajes(reservaId, { limite: 50 });
}

export async function marcarLeidoAction(reservaId: string): Promise<Res<boolean>> {
  return marcarChatLeido(reservaId);
}
