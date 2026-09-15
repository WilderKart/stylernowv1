"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación del Panel Negocio (02-UX/09_Business_Panel.md: "Navegación
 * (sidebar)"). Versión mínima de barra superior — crece con cada módulo que
 * se construya (Dashboard, Agenda, Servicios, Staff, Clientes, Caja,
 * Reportes, Configuración); hoy solo tiene los módulos que ya existen, para
 * no linkear a pantallas que todavía no se construyeron.
 */
const ITEMS = [
  { href: "/panel", etiqueta: "Resumen" },
  { href: "/panel/sedes", etiqueta: "Sedes" },
];

export function PanelNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto px-5 sm:px-10">
        {ITEMS.map((item) => {
          const activo =
            item.href === "/panel" ? pathname === "/panel" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 border-b-2 px-3.5 py-3 text-[12.5px] font-bold uppercase tracking-wide transition-colors",
                activo
                  ? "border-accent text-accent"
                  : "border-transparent text-text-faint hover:text-text-muted"
              )}
            >
              {item.etiqueta}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
