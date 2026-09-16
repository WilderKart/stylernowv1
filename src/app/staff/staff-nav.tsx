"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/staff/agenda", etiqueta: "Agenda" },
  { href: "/staff/nivel", etiqueta: "Mi Nivel" },
  { href: "/staff/clientes", etiqueta: "Clientes" },
  { href: "/staff/lealtad", etiqueta: "Lealtad" },
  { href: "/staff/perfil", etiqueta: "Perfil" },
];

export function StaffNav({ negocioNombre, esGuardian }: { negocioNombre: string; esGuardian: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 overflow-x-auto px-5 sm:px-10">
        {ITEMS.map((item) => {
          const activo = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 border-b-2 px-3.5 py-3 text-[12.5px] font-bold uppercase tracking-wide transition-colors",
                activo ? "border-accent text-accent" : "border-transparent text-text-faint hover:text-text-muted"
              )}
            >
              {item.etiqueta}
            </Link>
          );
        })}
        <span className="ml-auto shrink-0 truncate py-3 text-[11px] font-bold uppercase tracking-wide text-text-faint">
          {negocioNombre}
          {esGuardian ? " · Guardian" : ""}
        </span>
      </div>
    </nav>
  );
}
