"use server";

import { cuentaDePago } from "@/lib/pagos/conexiones";
import { buscarPagoPorReferencia } from "@/lib/pagos/mercadopago";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type EstadoPagoModal = {
  /** Estado del cobro en la base: lo decide el servidor al re-consultar a Mercado Pago, nunca el navegador. */
  estado: "SIN_PAGO" | "PENDIENTE" | "APROBADO" | "RECHAZADO";
  /** Mercado Pago ya recibió un intento que aún no se acredita (efectivo, PSE, Nequi en proceso…). */
  enProceso: boolean;
  /** Medio de pago informado por la pasarela (p. ej. `pse`, `efecty`), solo para el texto del modal. */
  medio: string | null;
};

const idSchema = z.uuid();

/**
 * Consulta (y reconcilia) el estado de un cobro de la plataforma para el modal de pago.
 * Cero confianza: la lectura pasa por RLS con la sesión de la persona (solo ve cobros de su negocio) y el estado
 * se confirma contra la API de Mercado Pago con el token del servidor; nada de esto lo decide el cliente.
 */
export async function consultarEstadoPagoModal(pagoId: string): Promise<EstadoPagoModal> {
  const id = idSchema.safeParse(pagoId);
  if (!id.success) return { estado: "SIN_PAGO", enProceso: false, medio: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { estado: "SIN_PAGO", enProceso: false, medio: null };

  const leer = async () => (await supabase.from("pago").select("estado").eq("id", id.data).maybeSingle()).data;
  let pago = await leer();
  if (!pago) return { estado: "SIN_PAGO", enProceso: false, medio: null };

  if (pago.estado === "PENDIENTE") {
    try {
      await sincronizarPago(id.data);
      pago = (await leer()) ?? pago;
    } catch (e) {
      console.error("[pagos/modal] no se pudo reconciliar el cobro", e instanceof Error ? e.message : e);
    }
  }

  if (pago.estado === "APROBADO") return { estado: "APROBADO", enProceso: false, medio: null };
  if (pago.estado === "RECHAZADO") return { estado: "RECHAZADO", enProceso: false, medio: null };

  // Sigue pendiente: ¿Mercado Pago ya tiene un intento en curso (efectivo, PSE…)? Solo informativo.
  let enProceso = false;
  let medio: string | null = null;
  try {
    const cuenta = await cuentaDePago(id.data);
    const pasarela = await buscarPagoPorReferencia(id.data, cuenta.token);
    if (pasarela && pasarela.estado === "PENDIENTE") {
      enProceso = true;
      medio = pasarela.metodo ?? pasarela.tipoMetodo ?? null;
    }
  } catch {
    /* sin detalle del intento: el modal sigue mostrando «esperando» */
  }
  return { estado: "PENDIENTE", enProceso, medio };
}
