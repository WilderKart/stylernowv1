import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ConfigPrueba {
  dias: number;
  modalidad: "SIN_TARJETA" | "CON_TARJETA" | "AMBAS";
}

/** Valores de la migración 118 si la RPC aún no existe en la base (antes de aplicarla). */
const POR_DEFECTO: ConfigPrueba = { dias: 14, modalidad: "SIN_TARJETA" };

type RpcSinTipos = {
  rpc: (n: string) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Configuración de la prueba gratuita que define Super Admin (solo para mostrar; la BD la reaplica). */
export async function obtenerConfigPrueba(): Promise<ConfigPrueba> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as RpcSinTipos).rpc("config_prueba");
  if (error || !data || typeof data !== "object") return POR_DEFECTO;
  const d = data as { dias?: unknown; modalidad?: unknown };
  const modalidad =
    d.modalidad === "CON_TARJETA" || d.modalidad === "AMBAS" || d.modalidad === "SIN_TARJETA"
      ? d.modalidad
      : POR_DEFECTO.modalidad;
  const dias = typeof d.dias === "number" && d.dias > 0 ? d.dias : POR_DEFECTO.dias;
  return { dias, modalidad };
}
