import { sumarDias } from "@/lib/formato";

/** "YYYY-MM" del mes siguiente/anterior (n puede ser negativo o mayor a 12). Diciembre → enero y viceversa sin errores. */
export function sumarMeses(ym: string, n: number): string {
  const [a, m] = ym.split("-").map(Number);
  const indice = a * 12 + (m - 1) + n;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

export function diasDelMes(ym: string): number {
  const [a, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate(); // día 0 del mes siguiente = último de este (maneja bisiestos)
}

/** Semanas (lunes a domingo) que cubren el mes; incluye los días del mes anterior/siguiente que completan la cuadrícula. */
export function semanasDelMes(ym: string): string[][] {
  const [a, m] = ym.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, 1)).getUTCDay(); // 0 = domingo
  const hueco = (dow + 6) % 7; // lunes = 0
  const filas = Math.ceil((hueco + diasDelMes(ym)) / 7);
  const inicio = sumarDias(`${ym}-01`, -hueco);
  return Array.from({ length: filas }, (_, f) => Array.from({ length: 7 }, (_, c) => sumarDias(inicio, f * 7 + c)));
}
