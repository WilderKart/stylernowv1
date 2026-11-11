"use server";

import { solicitarDevolucionSaldo } from "@/lib/cliente/mylook-pagos";
import { revalidatePath } from "next/cache";

export type ResultadoDevolucion = { ok: true; monto: number } | { ok: false; error: string };

/** Pide la devolución de TODO el saldo (la BD toma el saldo de la sesión; no se envía monto desde el navegador). */
export async function pedirDevolucion(): Promise<ResultadoDevolucion> {
  const r = await solicitarDevolucionSaldo();
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/pagos");
  return { ok: true, monto: r.data.monto };
}
