import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <p className="font-display mb-2 text-[56px] font-bold leading-none text-accent">404</p>
      <h1 className="font-display mb-2 text-[18px] font-bold uppercase text-text">
        No encontramos esta página
      </h1>
      <p className="mb-6 max-w-xs text-[13.5px] leading-relaxed text-text-muted">
        El link puede estar roto o el negocio que buscabas ya no está disponible.
      </p>
      <Button asChild size="lg" className="w-full max-w-xs">
        <Link href="/">VOLVER AL INICIO</Link>
      </Button>
    </div>
  );
}
