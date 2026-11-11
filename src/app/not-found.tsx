import { Num, Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-3 p-4">
        <Num>00 / 404</Num>
        <Poster as="h1" size={2} className="break-words">
          Aquí no
          <br />
          <span className="sn-hot">hay nada.</span>
        </Poster>
        <p className="body text-text-muted">
          Esta página no existe o se movió. El link puede estar roto o el negocio que buscabas ya no está disponible.
        </p>
        <Button asChild variant="secondary" size="lg" className="w-full justify-between">
          <Link href="/">
            <span>Volver al inicio</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Link>
        </Button>
      </main>
    </div>
  );
}
