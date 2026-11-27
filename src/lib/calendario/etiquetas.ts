const DIA3 = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MES3 = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** "DOM, 27 DE SEP, 2026" a partir de "YYYY-MM-DD" (sin pasar por la zona horaria: el día no se corre). */
export function fechaEtiqueta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIA3[dow]}, ${d} DE ${MES3[m - 1]}, ${a}`;
}

/** "30 MINUTOS", "1 HORA", "1 H 20 MIN". */
export function duracionEtiqueta(minutos: number): string {
  if (minutos < 60) return `${minutos} MINUTOS`;
  const h = Math.floor(minutos / 60);
  const r = minutos % 60;
  return r === 0 ? `${h} ${h === 1 ? "HORA" : "HORAS"}` : `${h} H ${r} MIN`;
}
