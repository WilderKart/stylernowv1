"use client";

import { cn } from "@/lib/utils";
import { Compass, Heart, Map, Ticket, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useT } from "@/lib/i18n/proveedor";

/**
 * Navegación principal de la Cliente PWA (patrón .sn-tabbar del prototipo): barra negra
 * fija con la pestaña activa en naranja. Se monta en las pantallas de "recorrido" (Home,
 * Mis Reservas, Favoritos, Perfil); las de un solo propósito (flujo de reserva, pago)
 * mantienen su propio CTA fijo. Se arma aquí y no con <TabBar> porque "Mapa" es la vista
 * `/?vista=mapa` del Home y TabBar solo compara el pathname.
 */
const ICONO = { strokeWidth: 2, strokeLinecap: "square", strokeLinejoin: "miter", "aria-hidden": true } as const;

const ITEMS = [
  { id: "explorar", href: "/", etiqueta: "nav.explorar", icono: <Compass {...ICONO} /> },
  { id: "mapa", href: "/?vista=mapa", etiqueta: "nav.mapa", icono: <Map {...ICONO} /> },
  { id: "citas", href: "/mis-reservas", etiqueta: "nav.citas", icono: <Ticket {...ICONO} /> },
  { id: "favoritos", href: "/favoritos", etiqueta: "nav.favoritos", icono: <Heart {...ICONO} /> },
  { id: "perfil", href: "/perfil", etiqueta: "nav.perfil", icono: <User {...ICONO} /> },
] as const;

function Barra() {
  const t = useT();
  const pathname = usePathname();
  const enMapa = useSearchParams().get("vista") === "mapa";

  function activo(id: (typeof ITEMS)[number]["id"], href: string) {
    if (id === "explorar") return pathname === "/" && !enMapa;
    if (id === "mapa") return pathname === "/" && enMapa;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav aria-label={t("nav.principal")} className="sn-tabbar pb-[env(safe-area-inset-bottom)]">
      {ITEMS.map((it) => {
        const a = activo(it.id, it.href);
        return (
          <Link
            key={it.id}
            href={it.href}
            aria-current={a ? "page" : undefined}
            className={cn("sn-tab min-w-0 no-underline", a && "is-active")}
          >
            {it.icono}
            <span className="max-w-full truncate">{t(it.etiqueta)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const t = useT();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <Suspense fallback={<nav aria-label={t("nav.principal")} className="sn-tabbar" />}>
        <Barra />
      </Suspense>
    </div>
  );
}
