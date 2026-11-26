/**
 * CSV seguro para Excel: escapa comillas/saltos y neutraliza celdas de TEXTO que empiezan por = + - @ (inyección de fórmulas).
 * Los números (incluidos los negativos) se escriben tal cual.
 */
export function celdaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  let t = String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function aCsv(columnas: string[], filas: unknown[][]): string {
  const lineas = [columnas.map(celdaCsv).join(","), ...filas.map((f) => f.map(celdaCsv).join(","))];
  return "﻿" + lineas.join("\r\n") + "\r\n";
}
