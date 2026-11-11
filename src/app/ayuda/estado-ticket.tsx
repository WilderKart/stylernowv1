import { Status } from "@/components/brutal";

const ESTADOS = {
  ABIERTO: { tone: "warn", etiqueta: "Abierto" },
  EN_PROCESO: { tone: "info", etiqueta: "En proceso" },
  RESUELTO: { tone: "ok", etiqueta: "Resuelto" },
} as const;

export function EstadoTicket({ estado }: { estado: keyof typeof ESTADOS }) {
  const e = ESTADOS[estado] ?? ESTADOS.ABIERTO;
  return <Status tone={e.tone}>{e.etiqueta}</Status>;
}
