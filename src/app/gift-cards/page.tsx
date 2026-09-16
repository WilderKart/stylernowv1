import { BarraSuperior } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export const metadata = { title: "Gift Cards" };

export default function GiftCardsHubPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Gift Cards" volverA="/" />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        <p className="mb-6 text-[13px] text-text-muted">
          Regalá una Gift Card digital para tu Barbería favorita — para vos, para otra persona, o por lote para tu empresa.
        </p>

        <div className="flex flex-col gap-3">
          <Link href="/gift-cards/comprar">
            <Card className="transition-colors hover:border-accent/40">
              <p className="text-[14px] font-bold text-text">Comprar una Gift Card</p>
              <p className="mt-0.5 text-[12px] text-text-muted">Elegí el monto, para quién es, y pagá en segundos.</p>
            </Card>
          </Link>
          <Link href="/gift-cards/mis">
            <Card className="transition-colors hover:border-accent/40">
              <p className="text-[14px] font-bold text-text">Mis Gift Cards</p>
              <p className="mt-0.5 text-[12px] text-text-muted">Las que compraste y las que te regalaron.</p>
            </Card>
          </Link>
          <Link href="/gift-cards/canjear">
            <Card className="transition-colors hover:border-accent/40">
              <p className="text-[14px] font-bold text-text">Consultar una Gift Card</p>
              <p className="mt-0.5 text-[12px] text-text-muted">Verificá el saldo antes de presentarla en el local.</p>
            </Card>
          </Link>
        </div>

        <p className="mt-6 rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-3 text-[11.5px] text-text-faint">
          El canje de una Gift Card se hace únicamente en el local, cuando el Staff la registra en el momento de tu visita — por seguridad, no se puede canjear a distancia.
        </p>
      </main>
    </div>
  );
}
