import { Button } from "@/components/ui/button";
import Link from "next/link";
import { obtenerT } from "@/lib/i18n/servidor";

/**
 * ADR-015 — UI de `forbidden()` (403 real, `experimental.authInterrupts`).
 * Se muestra cuando una sesión válida intenta abrir una superficie que no le
 * corresponde (ej. Staff abriendo una ruta de Panel) — nunca contenido, nunca
 * un redirect silencioso a otra parte.
 */
export default async function Forbidden() {
  const t = await obtenerT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <p className="font-display mb-2 text-[56px] font-bold leading-none text-danger">403</p>
      <h1 className="font-display mb-2 text-[18px] font-bold uppercase text-text">
        {t("forb.titulo")}
      </h1>
      <p className="mb-6 max-w-xs text-[13.5px] leading-relaxed text-text-muted">
        {t("forb.txt")}
      </p>
      <Button asChild size="lg" className="w-full max-w-xs">
        <Link href="/">{t("forb.volver")}</Link>
      </Button>
    </div>
  );
}
