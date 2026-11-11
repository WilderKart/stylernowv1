import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * ADR-015 — UI de `forbidden()` (403 real, `experimental.authInterrupts`).
 * Se muestra cuando una sesión válida intenta abrir una superficie que no le
 * corresponde (ej. Staff abriendo una ruta de Panel) — nunca contenido, nunca
 * un redirect silencioso a otra parte.
 */
export default function Forbidden() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <p className="font-display mb-2 text-[56px] font-bold leading-none text-danger">403</p>
      <h1 className="font-display mb-2 text-[18px] font-bold uppercase text-text">
        No tenés acceso a esta sección
      </h1>
      <p className="mb-6 max-w-xs text-[13.5px] leading-relaxed text-text-muted">
        Tu cuenta no tiene permiso para ver esta página. Si creés que es un error, contactá a tu negocio o a soporte.
      </p>
      <Button asChild size="lg" className="w-full max-w-xs">
        <Link href="/">VOLVER AL INICIO</Link>
      </Button>
    </div>
  );
}
