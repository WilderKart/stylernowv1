"use client";

import type { RolPanel } from "@/lib/auth/resolver-contexto";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación del Panel Negocio (02-UX/09_Business_Panel.md, ADR-006:
 * compartida entre Barbería y Guardian con ítems condicionados por rol).
 *
 * Solo lista módulos que YA EXISTEN como pantalla real — "Sedes" no
 * aparece para Guardian a propósito (administra la suya desde su propio
 * Resumen, no gestiona una lista de sedes ajenas). A medida que se
 * construyan Dashboard/Agenda/Servicios/CRM/Inventario (Módulos 2.2 y
 * 2.5-2.9), cada uno agrega su propia entrada acá, ya filtrada por
 * `permisos` — nunca una lista separada "para Guardian".
 */
export function PanelNav({ rol }: { rol: RolPanel }) {
  const pathname = usePathname();

  const items = [
    { href: "/panel", etiqueta: "Resumen" },
    ...(rol === "BARBERIA" ? [{ href: "/panel/sedes", etiqueta: "Sedes" }] : []),
    // Agenda, Staff y Servicios son compartidos entre Barbería y Guardian
    // (ADR-006) — el alcance lo resuelve la propia pantalla vía `permisos`,
    // nunca un ítem de nav distinto por rol.
    { href: "/panel/agenda", etiqueta: "Agenda" },
    { href: "/panel/staff", etiqueta: "Staff" },
    { href: "/panel/servicios", etiqueta: "Servicios" },
  ];

  return (
    <nav className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto px-5 sm:px-10">
        {items.map((item) => {
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
        {rol === "GUARDIAN" ? (
          <span className="ml-auto flex shrink-0 items-center text-[11px] font-bold uppercase tracking-wide text-accent">
            Guardian
          </span>
        ) : null}
      </div>
    </nav>
  );
}
