"use server";

import { createClient } from "@/lib/supabase/server";

const MENSAJES_ERROR: Record<string, string> = {
  GIFT_CARD_NO_ENCONTRADA: "No encontramos ninguna Gift Card con ese código.",
  PIN_INCORRECTO: "El PIN no es correcto.",
};
function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

export interface ConsultaGiftCard {
  montoOriginal: number;
  saldoActual: number;
  estado: string;
  fechaExpiracion: string | null;
  negocioNombre: string;
}

type Resultado = { ok: true; data: ConsultaGiftCard } | { ok: false; error: string };

export async function consultarMiGiftCard(codigo: string, pin: string): Promise<Resultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Iniciá sesión para consultar tu Gift Card." };

  const { data, error } = await supabase.rpc("consultar_gift_card", { p_codigo: codigo.trim(), p_pin: pin.trim() });
  if (error) return { ok: false, error: traducirError(error.message) };
  const fila = data?.[0];
  if (!fila) return { ok: false, error: "No encontramos ninguna Gift Card con ese código." };

  return {
    ok: true,
    data: {
      montoOriginal: Number(fila.monto_original),
      saldoActual: Number(fila.saldo_actual),
      estado: fila.estado,
      fechaExpiracion: fila.fecha_expiracion,
      negocioNombre: fila.negocio_nombre,
    },
  };
}
