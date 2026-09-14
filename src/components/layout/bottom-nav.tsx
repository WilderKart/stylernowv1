"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación principal de la Cliente PWA (02-UX/03_Client_PWA.md): Inicio, Citas,
 * Perfil. Se monta en las pantallas de "recorrido" (Home, perfil de Negocio, Mis
 * Reservas, Perfil) — las pantallas de un solo propósito (flujo de reserva, pago)
 * mantienen su propio CTA fijo en vez de competir con una segunda barra fija.
 */
const ITEMS = [
  {
    href: "/",
    etiqueta: "Inicio",
    icono: (activo: boolean) => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={activo ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    href: "/mis-reservas",
    etiqueta: "Citas",
    icono: (activo: boolean) => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={activo ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
      </svg>
    ),
  },
  {
    href: "/perfil",
    etiqueta: "Perfil",
    icono: (activo: boolean) => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={activo ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c1.3-3.7 4.3-5.5 7.5-5.5s6.2 1.8 7.5 5.5" />
      </svg>
    ),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-bg/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors",
                activo ? "text-accent" : "text-text-faint hover:text-text-muted"
              )}
            >
              {item.icono(activo)}
              {item.etiqueta}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
