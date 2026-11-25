"use client";

import { BotonTema } from "@/components/tema/tema-cliente";
import { useT } from "@/lib/i18n/proveedor";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoStylerNow } from "./logo-stylernow";

/**
 * Barra superior de las pantallas del cliente en tablet y escritorio (referencia de diseño): logo y enlaces principales.
 * En móvil no se muestra: ahí manda la barra inferior. Solo navega; no decide permisos.
 */
const ENLACES = [
  { href: "/", clave: "nav.explorar" },
  { href: "/mis-reservas", clave: "nav.citas" },
  { href: "/favoritos", clave: "nav.favoritos" },
  { href: "/lealtad", clave: "header.premios" },
  { href: "/perfil", clave: "nav.perfil" },
] as const;

export function NavSuperiorCliente() {
  const t = useT();
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-30 hidden border-b border-border/60 bg-app/85 backdrop-blur-md md:block">
      <div className="mx-auto flex min-h-16 w-full max-w-[1680px] items-center gap-6 px-[clamp(16px,3.4vw,56px)]">
        <Link href="/" aria-label={t("header.inicio")} className="flex shrink-0 items-center no-underline">
          <LogoStylerNow />
        </Link>
        <nav aria-label={t("nav.principal")} className="ml-6 flex items-center gap-2">
          {ENLACES.map((e) => {
            const activo = e.href === "/" ? ruta === "/" : ruta === e.href || ruta.startsWith(`${e.href}/`);
            return (
              <Link
                key={e.href}
                href={e.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold no-underline transition-colors",
                  activo ? "bg-signal text-white" : "text-text hover:bg-surface-2"
                )}
              >
                {t(e.clave)}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <BotonTema className="sn-iconbtn !w-9 shrink-0" />
        </div>
      </div>
    </header>
  );
}
