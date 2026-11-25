"use client";

import { cerrarSesion } from "@/app/perfil/actions";
import { BotonTema } from "@/components/tema/tema-cliente";
import type { RolPanel } from "@/lib/auth/resolver-contexto";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  BookOpen,
  Calculator,
  CalendarDays,
  CalendarX2,
  ChartColumn,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Crown,
  CreditCard,
  Ellipsis,
  Gift,
  Globe,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  Package,
  Palette,
  Scissors,
  ScrollText,
  Sparkles,
  Store,
  Tag,
  Users,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Navegación del panel de spa, salón y uñas (diseño unificado).
 *
 * Escritorio: barra lateral oscura flotante, compacta (solo iconos, con tooltip y submenú al pasar el cursor) que se
 * expande con un botón sutil y muestra los nombres con acordeón por categoría.
 * Móvil: NO reutiliza la barra de escritorio; usa cabecera ligera, barra inferior flotante tipo app nativa y una hoja
 * inferior «Más» con todos los módulos agrupados en acordeón. Sin desplazamiento horizontal.
 *
 * Solo lista pantallas que existen; los permisos reales siguen en el servidor y en la base de datos.
 */

interface Item {
  href: string;
  etiqueta: string;
  Icono: LucideIcon;
}
interface Grupo {
  id: string;
  titulo: string;
  Icono: LucideIcon;
  /** Frase corta bajo el título del banner de la categoría. */
  descripcion?: string;
  items: Item[];
}

function construirMenu(rol: RolPanel, prestaServicios: boolean): Grupo[] {
  const dueno = rol === "BARBERIA";
  if (rol === "ADMIN") {
    return [
      {
        id: "equipo",
        titulo: "Equipo",
        Icono: UsersRound,
        items: [{ href: "/panel/staff", etiqueta: "Equipo", Icono: UsersRound }, ...(prestaServicios ? [{ href: "/staff", etiqueta: "Mi agenda", Icono: CalendarDays }] : [])],
      },
    ];
  }
  const grupos: Grupo[] = [
    { id: "resumen", titulo: "Resumen", Icono: LayoutDashboard, items: [{ href: "/panel", etiqueta: "Resumen", Icono: LayoutDashboard }] },
    {
      id: "agenda",
      titulo: "Agenda",
      Icono: CalendarDays,
      descripcion: "Gestiona tus citas, clientes, caja e inventario.",
      items: [
        { href: "/panel/agenda", etiqueta: "Agenda", Icono: CalendarDays },
        { href: "/panel/crm", etiqueta: "Clientes", Icono: Users },
        { href: "/panel/pos", etiqueta: "Caja", Icono: Calculator },
        { href: "/panel/inventario", etiqueta: "Inventario", Icono: Package },
        ...(prestaServicios && dueno ? [{ href: "/staff", etiqueta: "Mi agenda", Icono: CalendarDays }] : []),
      ],
    },
    {
      id: "equipo",
      titulo: "Equipo y servicios",
      Icono: Scissors,
      descripcion: "Administra tu equipo, solicitudes, servicios y sedes.",
      items: [
        { href: "/panel/staff", etiqueta: "Staff", Icono: UsersRound },
        { href: "/panel/staff/solicitudes", etiqueta: "Solicitudes", Icono: Inbox },
        { href: "/panel/servicios", etiqueta: "Servicios", Icono: Scissors },
        ...(dueno ? [{ href: "/panel/sedes", etiqueta: "Sedes", Icono: MapPin }] : []),
      ],
    },
  ];
  if (dueno) {
    grupos.push(
      {
        id: "marketing",
        titulo: "Marketing",
        Icono: Megaphone,
        descripcion: "Atrae y fideliza clientes con promociones, publicidad, lealtad, WhatsApp e IA.",
        items: [
          { href: "/panel/promociones", etiqueta: "Promociones", Icono: Tag },
          { href: "/panel/ads", etiqueta: "Publicidad", Icono: Megaphone },
          { href: "/panel/lealtad", etiqueta: "Lealtad", Icono: Gift },
          { href: "/panel/whatsapp", etiqueta: "WhatsApp", Icono: MessageCircle },
          { href: "/panel/ia", etiqueta: "IA", Icono: Sparkles },
        ],
      },
      {
        id: "finanzas",
        titulo: "Finanzas",
        Icono: Wallet,
        descripcion: "Gestiona tus cobros, ventas, saldo y plan de tu negocio.",
        items: [
          { href: "/panel/cobros", etiqueta: "Cobros", Icono: CreditCard },
          { href: "/panel/libro", etiqueta: "Libro", Icono: BookOpen },
          { href: "/panel/wallet", etiqueta: "Wallet", Icono: Wallet },
          { href: "/panel/reportes", etiqueta: "Reportes", Icono: ChartColumn },
          { href: "/panel/politica", etiqueta: "Anticipo y cancelaciones", Icono: CalendarX2 },
          { href: "/panel/suscripcion", etiqueta: "Mi Plan", Icono: Crown },
        ],
      },
      {
        id: "negocio",
        titulo: "Mi negocio",
        Icono: Store,
        descripcion: "Perfil público, marca, verificación, auditoría y soporte.",
        items: [
          { href: "/panel/perfil-publico", etiqueta: "Perfil público", Icono: Globe },
          { href: "/panel/marca", etiqueta: "Mi Marca", Icono: Palette },
          { href: "/panel/verificacion", etiqueta: "Verificación", Icono: BadgeCheck },
          { href: "/panel/auditoria", etiqueta: "Auditoría", Icono: ScrollText },
          { href: "/panel/soporte", etiqueta: "Soporte", Icono: LifeBuoy },
        ],
      },
    );
  } else {
    grupos.push(
      { id: "finanzas", titulo: "Finanzas", Icono: Wallet, items: [{ href: "/panel/reportes", etiqueta: "Reportes", Icono: ChartColumn }] },
      { id: "negocio", titulo: "Mi negocio", Icono: Store, items: [{ href: "/panel/soporte", etiqueta: "Soporte", Icono: LifeBuoy }] },
    );
  }
  return grupos;
}

function esActivo(pathname: string, href: string) {
  if (href === "/panel") return pathname === "/panel";
  // «Staff» no debe quedar activo cuando se está en su subpágina «Solicitudes».
  if (href === "/panel/staff") return pathname.startsWith("/panel/staff") && !pathname.startsWith("/panel/staff/solicitudes");
  return pathname.startsWith(href);
}

function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--side-text)] font-extrabold text-[var(--side-bg)]">
        S
      </span>
      {compacta ? null : (
        <span className="text-[18px] font-extrabold leading-none tracking-tight">
          Styler<span className="opacity-70">Now</span>
        </span>
      )}
    </span>
  );
}

function BotonSalir({ clase, conTexto = false, onSalida }: { clase?: string; conTexto?: boolean; onSalida?: () => void }) {
  const router = useRouter();
  const [saliendo, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={saliendo}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      onClick={() =>
        iniciar(async () => {
          onSalida?.();
          await cerrarSesion();
          router.replace("/login");
          router.refresh();
        })
      }
      className={cn("pn-pill flex items-center justify-center gap-3 disabled:opacity-50", clase)}
    >
      <LogOut className="size-5 shrink-0" aria-hidden />
      {conTexto ? <span className="text-[13.5px] font-semibold">Cerrar sesión</span> : null}
    </button>
  );
}

export function PanelNavSuave({ rol, prestaServicios = false }: { rol: RolPanel; prestaServicios?: boolean }) {
  const pathname = usePathname();
  const grupos = construirMenu(rol, prestaServicios);
  const grupoActivo = grupos.find((g) => g.items.some((i) => esActivo(pathname, i.href)));

  const [expandida, setExpandida] = useState(false);
  const [hoja, setHoja] = useState(false);
  // Acordeón: una sola categoría abierta a la vez (por defecto, la de la página actual).
  const [abierto, setAbierto] = useState<string | null>(grupoActivo?.id ?? null);
  const asideRef = useRef<HTMLElement>(null);

  // Al navegar, cierra la barra expandida y la hoja y abre la categoría de la página nueva (ajuste durante el render, sin efecto).
  const [rutaPrevia, setRutaPrevia] = useState(pathname);
  if (rutaPrevia !== pathname) {
    setRutaPrevia(pathname);
    setExpandida(false);
    setHoja(false);
    setAbierto(grupoActivo?.id ?? null);
  }

  // Escape cierra; un clic fuera de la barra expandida la repliega.
  useEffect(() => {
    if (!expandida && !hoja) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandida(false);
        setHoja(false);
      }
    };
    const alPulsar = (e: PointerEvent) => {
      if (expandida && asideRef.current && !asideRef.current.contains(e.target as Node)) setExpandida(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alPulsar);
    if (hoja) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alPulsar);
      document.body.style.overflow = "";
    };
  }, [expandida, hoja]);

  const finanzas = grupos.find((g) => g.id === "finanzas");
  const rapidos: { href: string; etiqueta: string; Icono: LucideIcon; activo: boolean }[] =
    rol === "ADMIN"
      ? grupos.flatMap((g) => g.items.slice(0, 1).map((i) => ({ ...i, activo: esActivo(pathname, i.href) })))
      : [
          { href: "/panel", etiqueta: "Inicio", Icono: LayoutDashboard, activo: esActivo(pathname, "/panel") },
          { href: "/panel/agenda", etiqueta: "Agenda", Icono: CalendarDays, activo: esActivo(pathname, "/panel/agenda") },
          { href: "/panel/crm", etiqueta: "Clientes", Icono: Users, activo: esActivo(pathname, "/panel/crm") },
          ...(finanzas ? [{ href: finanzas.items[0].href, etiqueta: "Finanzas", Icono: Wallet, activo: finanzas.items.some((i) => esActivo(pathname, i.href)) }] : []),
        ];
  const enRapidos = rapidos.some((r) => r.activo);

  return (
    <>
      {/* ───────── Escritorio: barra lateral flotante ───────── */}
      <aside
        ref={asideRef}
        aria-label="Navegación del panel"
        data-expandida={expandida}
        className={cn(
          "pn-side pn-anim fixed bottom-4 left-4 top-4 z-40 hidden flex-col bg-[var(--side-bg)] py-4 text-[var(--side-text)] transition-[width] duration-300 lg:flex",
          expandida ? "w-[280px]" : "w-[76px]",
        )}
      >
        <div className={cn("flex items-center", expandida ? "justify-between px-4" : "justify-center")}>
          <Link href="/panel" aria-label="StylerNow, ir al resumen">
            <Marca compacta={!expandida} />
          </Link>
        </div>

        <nav className={cn("mt-6 flex min-h-0 flex-1 flex-col gap-1.5", expandida ? "overflow-y-auto overscroll-contain px-3" : "items-center px-2")}>
          {grupos.map((g) => {
            const activo = g.id === grupoActivo?.id;
            const unico = g.items.length === 1;
            if (!expandida) {
              return (
                <div key={g.id} className="group relative">
                  <Link
                    href={g.items[0].href}
                    aria-label={g.titulo}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "pn-pill pn-anim grid size-12 place-items-center transition-colors",
                      activo ? "bg-[var(--side-text)] text-[var(--side-bg)]" : "text-[var(--side-muted)] hover:bg-[var(--side-active-bg)] hover:text-[var(--side-text)]",
                    )}
                  >
                    <g.Icono className="size-[22px]" aria-hidden />
                  </Link>
                  {/* Tooltip / submenú al pasar el cursor o enfocar con el teclado. */}
                  <div className="pointer-events-none invisible absolute left-full top-0 z-50 pl-4 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                    <div className="pn-card min-w-44 bg-[var(--bg)] p-2 text-[var(--text)] shadow-[var(--sn-shadow-hard)] ring-1 ring-[var(--line)]">
                      <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{g.titulo}</p>
                      {unico ? null : (
                        <ul>
                          {g.items.map((i) => (
                            <li key={i.href}>
                              <Link
                                href={i.href}
                                aria-current={esActivo(pathname, i.href) ? "page" : undefined}
                                className={cn(
                                  "pn-pill flex min-h-10 items-center gap-2.5 px-3 text-[13px] font-semibold hover:bg-[var(--surface-2)]",
                                  esActivo(pathname, i.href) && "bg-[var(--nav-active-bg)] text-[var(--accent-text)]",
                                )}
                              >
                                <i.Icono className="size-4 shrink-0" aria-hidden />
                                {i.etiqueta}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            if (unico) {
              return (
                <Link
                  key={g.id}
                  href={g.items[0].href}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "pn-pill pn-anim flex min-h-12 items-center gap-3 px-4 text-[14px] font-semibold transition-colors",
                    activo ? "bg-[var(--side-text)] text-[var(--side-bg)]" : "text-[var(--side-muted)] hover:bg-[var(--side-active-bg)] hover:text-[var(--side-text)]",
                  )}
                >
                  <g.Icono className="size-[20px] shrink-0" aria-hidden />
                  {g.titulo}
                </Link>
              );
            }
            const esAbierto = abierto === g.id;
            return (
              <div key={g.id}>
                <button
                  type="button"
                  aria-expanded={esAbierto}
                  aria-controls={`pn-sub-${g.id}`}
                  onClick={() => setAbierto(esAbierto ? null : g.id)}
                  className={cn(
                    "pn-pill pn-anim flex min-h-12 w-full items-center gap-3 px-4 text-left text-[14px] font-semibold transition-colors",
                    activo ? "bg-[var(--side-active-bg)] text-[var(--side-text)]" : "text-[var(--side-muted)] hover:bg-[var(--side-active-bg)] hover:text-[var(--side-text)]",
                  )}
                >
                  <g.Icono className="size-[20px] shrink-0" aria-hidden />
                  <span className="flex-1">{g.titulo}</span>
                  <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200", esAbierto && "rotate-180")} aria-hidden />
                </button>
                <ul id={`pn-sub-${g.id}`} hidden={!esAbierto} className="mt-1 flex flex-col gap-0.5 pb-1 pl-4">
                  {g.items.map((i) => {
                    const a = esActivo(pathname, i.href);
                    return (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          aria-current={a ? "page" : undefined}
                          className={cn(
                            "pn-pill flex min-h-11 items-center gap-3 px-4 text-[13.5px] font-medium transition-colors",
                            a ? "bg-[var(--side-text)] font-semibold text-[var(--side-bg)]" : "text-[var(--side-muted)] hover:bg-[var(--side-active-bg)] hover:text-[var(--side-text)]",
                          )}
                        >
                          <i.Icono className="size-[18px] shrink-0" aria-hidden />
                          {i.etiqueta}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className={cn("mt-3 flex flex-col gap-1.5 border-t border-[var(--side-borde)] pt-3", expandida ? "px-3" : "items-center px-2")}>
          <div className={cn("flex items-center", expandida ? "justify-between px-2" : "justify-center")}>
            {expandida ? <span className="text-[12px] font-semibold text-[var(--side-muted)]">Apariencia</span> : null}
            <BotonTema className="pn-pill grid size-10 place-items-center text-[var(--side-muted)] hover:bg-[var(--side-active-bg)] hover:text-[var(--side-text)]" />
          </div>
          <BotonSalir
            conTexto={expandida}
            clase={cn("text-[var(--side-muted)] hover:bg-[var(--side-active-bg)] hover:text-[var(--side-text)]", expandida ? "min-h-11 w-full px-4" : "size-10")}
          />
          <button
            type="button"
            onClick={() => setExpandida((v) => !v)}
            aria-expanded={expandida}
            aria-label={expandida ? "Contraer menú" : "Expandir menú y ver los nombres"}
            title={expandida ? "Contraer menú" : "Expandir menú"}
            className={cn(
              "pn-pill flex items-center justify-center gap-2 bg-[var(--side-active-bg)] text-[var(--side-text)] transition-colors hover:bg-[var(--side-borde)]",
              expandida ? "min-h-10 w-full px-4 text-[12.5px] font-semibold" : "size-10",
            )}
          >
            {expandida ? <ChevronsLeft className="size-4" aria-hidden /> : <ChevronsRight className="size-4" aria-hidden />}
            {expandida ? "Contraer" : null}
          </button>
        </div>
      </aside>

      {/* Escritorio: banner de la categoría y módulos hermanos (como en la referencia de Finanzas). */}
      {grupoActivo && grupoActivo.items.length > 1 ? (
        <div className="mx-auto hidden w-full max-w-6xl flex-wrap items-center gap-4 px-4 pt-6 sm:px-8 lg:flex">
          <div className="pn-card min-w-[280px] flex-1 bg-[image:var(--hero-gradient)] px-6 py-4 text-[var(--hero-text)] shadow-[var(--sn-shadow-hard-sm)]">
            <p className="text-[24px] font-extrabold leading-tight">{grupoActivo.titulo}</p>
            {grupoActivo.descripcion ? <p className="mt-0.5 text-[13.5px] leading-snug opacity-85">{grupoActivo.descripcion}</p> : null}
          </div>
          <nav aria-label={grupoActivo.titulo} className="flex flex-wrap justify-end gap-2">
            {grupoActivo.items.map((i) => {
              const a = esActivo(pathname, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={a ? "page" : undefined}
                  className={cn(
                    "pn-pill inline-flex min-h-10 items-center gap-2 px-4 text-[13px] font-semibold shadow-[var(--sn-shadow-hard-sm)] transition-colors",
                    a ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  <i.Icono className="size-4 shrink-0" aria-hidden />
                  {i.etiqueta}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      {/* ───────── Móvil: cabecera ligera ───────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-[color-mix(in_srgb,var(--app-bg)_88%,transparent)] px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md lg:hidden">
        <Link href="/panel" className="flex items-center gap-2.5 text-[var(--text)]" aria-label="StylerNow, ir al resumen">
          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-[var(--text)] text-[15px] font-extrabold text-[var(--bg)]">
            S
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">
            Styler<span className="text-[var(--brand)]">Now</span>
          </span>
        </Link>
        <BotonTema className="pn-pill grid size-11 place-items-center bg-[var(--bg)] text-[var(--text)] shadow-[var(--sn-shadow-hard-sm)]" />
      </header>

      {/* ───────── Móvil: barra inferior flotante ───────── */}
      <nav
        aria-label="Accesos rápidos"
        className="pn-side fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid bg-[var(--bg)] p-1.5 text-[var(--text)] shadow-[var(--sn-shadow-hard)] ring-1 ring-[var(--line)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${rapidos.length + 1}, minmax(0, 1fr))`, borderRadius: 28 }}
      >
        {rapidos.map(({ href, etiqueta, Icono, activo }) => (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "pn-pill pn-anim flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors",
              activo ? "bg-[var(--nav-active-bg)] text-[var(--accent-text)]" : "text-[var(--text-muted)]",
            )}
          >
            <Icono className="size-[22px]" aria-hidden />
            {etiqueta}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setHoja(true)}
          aria-haspopup="dialog"
          aria-expanded={hoja}
          className={cn(
            "pn-pill pn-anim flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors",
            !enRapidos && rol !== "ADMIN" ? "bg-[var(--nav-active-bg)] text-[var(--accent-text)]" : "text-[var(--text-muted)]",
          )}
        >
          <Ellipsis className="size-[22px]" aria-hidden />
          Más
        </button>
      </nav>

      {/* ───────── Móvil: hoja inferior con todos los módulos ───────── */}
      {hoja ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Todos los módulos">
          <button type="button" aria-label="Cerrar menú" className="pn-scrim absolute inset-0 bg-[var(--scrim)]" onClick={() => setHoja(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col bg-[var(--app-bg)] text-[var(--text)] shadow-[0_-18px_50px_-20px_rgba(0,0,0,0.5)]" style={{ borderRadius: "28px 28px 0 0" }}>
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--line-input)]" />
              <h2 className="pt-3 text-[18px] font-extrabold">Menú</h2>
              <button type="button" onClick={() => setHoja(false)} aria-label="Cerrar" className="pn-pill mt-2 grid size-11 place-items-center bg-[var(--bg)] shadow-[var(--sn-shadow-hard-sm)]">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-2.5">
                {grupos.map((g) => {
                  const activo = g.id === grupoActivo?.id;
                  if (g.items.length === 1) {
                    const i = g.items[0];
                    return (
                      <Link
                        key={g.id}
                        href={i.href}
                        aria-current={activo ? "page" : undefined}
                        className={cn("pn-card flex min-h-14 items-center gap-3 bg-[var(--bg)] px-4 text-[15px] font-semibold shadow-[var(--sn-shadow-hard-sm)]", activo && "ring-2 ring-[var(--brand)]")}
                      >
                        <span className="pn-pill grid size-9 place-items-center bg-[var(--pn-violet-soft)] text-[var(--pn-violet)]">
                          <g.Icono className="size-[18px]" aria-hidden />
                        </span>
                        {g.titulo}
                      </Link>
                    );
                  }
                  const esAbierto = abierto === g.id;
                  return (
                    <section key={g.id} className="pn-card overflow-hidden bg-[var(--bg)] shadow-[var(--sn-shadow-hard-sm)]">
                      <button
                        type="button"
                        aria-expanded={esAbierto}
                        aria-controls={`pn-hoja-${g.id}`}
                        onClick={() => setAbierto(esAbierto ? null : g.id)}
                        className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold"
                      >
                        <span className="pn-pill grid size-9 place-items-center bg-[var(--pn-violet-soft)] text-[var(--pn-violet)]">
                          <g.Icono className="size-[18px]" aria-hidden />
                        </span>
                        <span className="flex-1">{g.titulo}</span>
                        <ChevronDown className={cn("size-5 text-[var(--text-faint)] transition-transform duration-200", esAbierto && "rotate-180")} aria-hidden />
                      </button>
                      <ul id={`pn-hoja-${g.id}`} hidden={!esAbierto} className="grid grid-cols-2 gap-2 px-3 pb-3">
                        {g.items.map((i) => {
                          const a = esActivo(pathname, i.href);
                          return (
                            <li key={i.href}>
                              <Link
                                href={i.href}
                                aria-current={a ? "page" : undefined}
                                className={cn(
                                  "pn-card flex min-h-14 items-center gap-2.5 px-3 text-[13px] font-semibold",
                                  a ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--surface)] text-[var(--text)]",
                                )}
                              >
                                <i.Icono className="size-[18px] shrink-0" aria-hidden />
                                <span className="min-w-0 break-words leading-tight">{i.etiqueta}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
              <BotonSalir conTexto clase="mt-4 min-h-12 w-full bg-[var(--bg)] px-4 text-[var(--text)] shadow-[var(--sn-shadow-hard-sm)]" onSalida={() => setHoja(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
