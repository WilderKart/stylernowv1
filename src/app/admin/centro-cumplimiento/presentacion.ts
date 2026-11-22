export const ETIQUETA_ESTADO: Record<string, string> = {
  NUEVO: "Nuevo",
  EN_REVISION: "En revisión",
  ASIGNADO: "Asignado",
  EN_GESTION: "En gestión",
  ESPERANDO_SOLICITANTE: "Esperando al solicitante",
  ESPERANDO_TERCERO: "Esperando a un tercero",
  ESCALADO: "Escalado",
  RESPONDIDO: "Respondido",
  RESUELTO: "Resuelto",
  CERRADO: "Cerrado",
  REABIERTO: "Reabierto",
  DESISTIDO: "Desistido",
  TRASLADADO: "Trasladado",
};

/** Cómo se presenta cada origen de plazo: solo «verificado» se muestra como obligación legal. */
export const ETIQUETA_ORIGEN: Record<string, string> = {
  LEGAL_VERIFICADO: "Plazo legal verificado",
  LEGAL_PROVISIONAL: "Plazo provisional (no verificado)",
  INTERNO: "Plazo interno (no es ley)",
};

export const TONO_PRIORIDAD: Record<string, "neutro" | "acento" | "ok" | "alerta" | "peligro"> = {
  CRITICA: "peligro",
  ALTA: "alerta",
  NORMAL: "neutro",
  BAJA: "ok",
};

export function formatoFecha(s: string | null | undefined): string {
  return s ? new Date(s).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }) : "—";
}

export function restante(horas: number | null, vencido: boolean): string {
  if (horas === null) return "sin plazo";
  if (vencido || horas < 0) return `vencido hace ${Math.max(1, Math.round(Math.abs(horas)))} h`;
  if (horas < 48) return `faltan ${Math.round(horas)} h`;
  return `faltan ${Math.round(horas / 24)} días`;
}
