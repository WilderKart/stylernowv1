"use client";

import { Status } from "@/components/brutal";
import { useT } from "@/lib/i18n/proveedor";

const ESTADOS = {
  ABIERTO: { tone: "warn", etiqueta: "ay.abierto" },
  EN_PROCESO: { tone: "info", etiqueta: "ay.en_proceso" },
  RESUELTO: { tone: "ok", etiqueta: "ay.resuelto" },
} as const;

export function EstadoTicket({ estado }: { estado: keyof typeof ESTADOS }) {
  const t = useT();
  const e = ESTADOS[estado] ?? ESTADOS.ABIERTO;
  return <Status tone={e.tone}>{t(e.etiqueta)}</Status>;
}
