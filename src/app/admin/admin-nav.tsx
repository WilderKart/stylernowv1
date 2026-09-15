"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", etiqueta: "Dashboard" },
  { href: "/admin/negocios", etiqueta: "Negocios" },
  { href: "/admin/moderacion", etiqueta: "Moderación" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-1 overflow-x-auto px-5 sm:px-10">
        {ITEMS.map((item) => {
          const activo = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
        <span className="ml-auto shrink-0 py-3 text-[11px] font-bold uppercase tracking-wide text-danger">SuperSU</span>
      </div>
    </nav>
  );
}
