"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export type TabItem = { href: string; label: string; icon: React.ReactNode; badge?: boolean; match?: "exact" | "prefix" };

/** Barra de pestañas inferior negra (patrón .sn-tabbar). El rol decide los items. */
export function TabBar({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className={cn("sn-tabbar pb-[env(safe-area-inset-bottom)]", className)}>
      {items.map((it) => {
        const activo = it.match === "exact" ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={activo ? "page" : undefined}
            className={cn("sn-tab no-underline", activo && "is-active")}
          >
            <span className={it.badge ? "sn-tab__badge" : undefined}>{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Cabecera de pantalla con título de póster y acciones opcionales. */
export function ScreenHeader({
  title,
  back,
  right,
  big,
  className,
}: {
  title: string;
  back?: string;
  right?: React.ReactNode;
  big?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("sn-header", !big && "sn-header--compact", className)}>
      <div className="sn-header__bar">
        {back ? (
          <Link href={back} className="sn-iconbtn" aria-label="Volver">
            <ChevronLeft />
          </Link>
        ) : (
          <span className="sn-header__title pl-2">{big ? "StylerNow" : title}</span>
        )}
        {back ? <span className="sn-header__title flex-1 truncate">{title}</span> : null}
        <div className="flex items-center">{right}</div>
      </div>
      {big ? <h1 className="sn-header__big poster-1 break-words whitespace-normal">{title}</h1> : null}
    </header>
  );
}
