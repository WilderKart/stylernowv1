import { Card } from "@/components/ui/card";
import Link from "next/link";

/**
 * Aviso estándar cuando una función o un cupo no están incluidos en el plan del negocio.
 * Solo informa y lleva a Suscripción: la regla real la hace cumplir el servidor (RLS/RPC), nunca esta pantalla.
 */
export function AvisoPlan({
  titulo,
  detalle,
  accion = "VER PLANES",
  href = "/panel/suscripcion",
}: {
  titulo: string;
  detalle: string;
  accion?: string;
  href?: string;
}) {
  return (
    <Card role="status" className="border-accent bg-app shadow-[4px_4px_0_0_var(--color-ink,#111)]">
      <p className="font-display text-[15px] font-bold uppercase text-text">{titulo}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{detalle}</p>
      <Link
        href={href}
        className="mt-3 inline-block bg-accent px-4 py-2.5 text-[12.5px] font-bold uppercase text-ink hover:bg-accent-hover"
      >
        {accion}
      </Link>
    </Card>
  );
}
