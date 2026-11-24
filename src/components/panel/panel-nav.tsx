"use client";

import type { RolPanel } from "@/lib/auth/resolver-contexto";
import { cn } from "@/lib/utils";
import { CalendarDays, Gift, LayoutDashboard, Menu, Scissors, Settings, ShieldCheck, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BotonTema } from "@/components/tema/tema-cliente";

/** Iconos de la barra lateral y del menú. Los módulos sin icono propio usan un cuadro de la marca. */
const ICONOS: Record<string, LucideIcon> = {
  "/panel": LayoutDashboard,
  "/panel/agenda": CalendarDays,
  "/panel/staff": Users,
  "/panel/servicios": Scissors,
  "/panel/lealtad": Gift,
  "/panel/verificacion": ShieldCheck,
  "/panel/perfil-publico": Settings,
};

interface Item {
  href: string;
  etiqueta: string;
}
interface Grupo {
  titulo: string;
  items: Item[];
}

/**
 * Navegación del Panel Negocio (02-UX/09_Business_Panel.md, ADR-006: compartida entre Barbería y Guardian con ítems
 * condicionados por rol). Solo lista módulos que YA EXISTEN como pantalla real.
 *
 * Los módulos están AGRUPADOS por tema (Operación, Equipo, Marketing, Dinero, Mi negocio) para que la lista larga se lea
 * de un vistazo. Escritorio: barra lateral oscura fija. Móvil: barra superior con botón de menú (cajón con los mismos
 * grupos) + barra inferior con los cuatro accesos de uso diario. Ya no hay franja con desplazamiento horizontal.
 */
export function PanelNav({ rol, prestaServicios = false }: { rol: RolPanel; /** Perfil profesional activo: añade el acceso a la agenda propia (/staff). */ prestaServicios?: boolean }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
  }, [abierto]);

  const dueno = rol === "BARBERIA";
  // Administrador delegado (migración 161): su superficie son los módulos revisados para él. Hoy solo el equipo; el resto del panel
  // sigue siendo del propietario hasta revisar sus políticas (denegado por defecto).
  const grupos: Grupo[] =
    rol === "ADMIN"
      ? [{ titulo: "Equipo", items: [{ href: "/panel/staff", etiqueta: "Equipo" }, ...(prestaServicios ? [{ href: "/staff", etiqueta: "Mi agenda" }] : [])] }]
      : [
          {
            titulo: "Operación",
            items: [
              { href: "/panel", etiqueta: "Resumen" },
              { href: "/panel/agenda", etiqueta: "Agenda" },
              { href: "/panel/crm", etiqueta: "Clientes" },
              { href: "/panel/pos", etiqueta: "Caja" },
              { href: "/panel/inventario", etiqueta: "Inventario" },
              ...(prestaServicios && dueno ? [{ href: "/staff", etiqueta: "Mi agenda" }] : []),
            ],
          },
          {
            titulo: "Equipo y servicios",
            items: [
              { href: "/panel/staff", etiqueta: "Staff" },
              { href: "/panel/staff/solicitudes", etiqueta: "Solicitudes" },
              { href: "/panel/servicios", etiqueta: "Servicios" },
              ...(dueno ? [{ href: "/panel/sedes", etiqueta: "Sedes" }] : []),
            ],
          },
          ...(dueno
            ? [
                {
                  titulo: "Marketing",
                  items: [
                    { href: "/panel/promociones", etiqueta: "Promociones" },
                    { href: "/panel/ads", etiqueta: "Publicidad" },
                    { href: "/panel/lealtad", etiqueta: "Lealtad" },
                    { href: "/panel/whatsapp", etiqueta: "WhatsApp" },
                    { href: "/panel/ia", etiqueta: "IA" },
                  ],
                },
                {
                  titulo: "Dinero",
                  items: [
                    { href: "/panel/cobros", etiqueta: "Cobros" },
                    { href: "/panel/libro", etiqueta: "Libro" },
                    { href: "/panel/wallet", etiqueta: "Wallet" },
                    { href: "/panel/reportes", etiqueta: "Reportes" },
                    { href: "/panel/politica", etiqueta: "Anticipo y cancelaciones" },
                    { href: "/panel/suscripcion", etiqueta: "Mi Plan" },
                  ],
                },
                {
                  titulo: "Mi negocio",
                  items: [
                    { href: "/panel/perfil-publico", etiqueta: "Perfil público" },
                    { href: "/panel/marca", etiqueta: "Mi Marca" },
                    { href: "/panel/verificacion", etiqueta: "Verificación" },
                    { href: "/panel/auditoria", etiqueta: "Auditoría" },
                    { href: "/panel/soporte", etiqueta: "Soporte" },
                  ],
                },
              ]
            : [
                {
                  titulo: "Más",
                  items: [
                    { href: "/panel/reportes", etiqueta: "Reportes" },
                    { href: "/panel/soporte", etiqueta: "Soporte" },
                  ],
                },
              ]),
        ];

  const esActivo = (href: string) => {
    if (href === "/panel") return pathname === "/panel";
    // «Staff» no debe quedar activo cuando se está en su subpágina «Solicitudes».
    if (href === "/panel/staff") return pathname.startsWith("/panel/staff") && !pathname.startsWith("/panel/staff/solicitudes");
    return pathname.startsWith(href);
  };

  // Barra inferior móvil: los cuatro accesos de uso diario.
  const inferior =
    rol === "ADMIN"
      ? []
      : [
          { href: "/panel", etiqueta: "Inicio", Icono: LayoutDashboard },
          { href: "/panel/agenda", etiqueta: "Agenda", Icono: CalendarDays },
          { href: "/panel/staff", etiqueta: "Barberos", Icono: Users },
          dueno ? { href: "/panel/perfil-publico", etiqueta: "Ajustes", Icono: Settings } : { href: "/panel/soporte", etiqueta: "Soporte", Icono: Settings },
        ];

  const listaGrupos = (conIconos: boolean, alNavegar?: () => void) => (
    <div className="flex flex-col gap-4">
      {grupos.map((g) => (
        <section key={g.titulo} aria-label={g.titulo}>
          <h3 className="px-3 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.66px] text-[var(--nav-muted)]">{g.titulo}</h3>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const activo = esActivo(item.href);
              const Icono = ICONOS[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={alNavegar}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 border-l-4 px-3 py-2.5 text-[12.5px] font-bold uppercase tracking-wide transition-colors",
                      activo ? "border-[var(--nav-accent)] bg-[var(--nav-active-bg)] text-[var(--nav-accent)]" : "border-transparent text-[var(--nav-muted)] hover:bg-[var(--nav-active-bg)] hover:text-[var(--nav-text)]"
                    )}
                  >
                    {conIconos ? (
                      Icono ? (
                        <Icono className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <span className="w-4 shrink-0 text-center text-[var(--nav-accent)]" aria-hidden>
                          ▪
                        </span>
                      )
                    ) : null}
                    {item.etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <>
      {/* Escritorio: barra lateral oscura fija. */}
      <aside aria-label="Navegación del panel" className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[var(--nav-bg)] text-[var(--nav-text)] lg:flex">
        <Link href="/panel" className="px-5 py-5 font-display text-[22px] font-bold uppercase leading-none tracking-tight">
          STYLER<span className="text-[var(--nav-accent)]">NOW</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">{listaGrupos(true)}</nav>
        <div className="flex items-center justify-between border-t border-[var(--nav-borde)] px-4 py-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.66px] text-[var(--nav-muted)]">Apariencia</span>
          <BotonTema className="flex size-10 items-center justify-center border-2 border-[var(--nav-borde)]" />
        </div>
        {rol === "GUARDIAN" ? <p className="border-t border-[var(--nav-borde)] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--nav-accent)]">Guardian</p> : null}
      </aside>

      {/* Móvil: barra superior con botón de menú. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-[var(--nav-bg)] px-4 py-2.5 text-[var(--nav-text)] lg:hidden">
        <Link href="/panel" className="font-display text-[20px] font-bold uppercase leading-none tracking-tight">
          STYLER<span className="text-[var(--nav-accent)]">NOW</span>
        </Link>
        <BotonTema className="ml-auto flex size-11 items-center justify-center border-2 border-[var(--nav-borde)]" />
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex min-h-11 items-center gap-2 border-2 border-[var(--nav-borde)] px-3 font-mono text-[11px] font-bold uppercase"
        >
          <Menu className="size-4" aria-hidden />
          Menú
        </button>
      </header>

      {/* Móvil: cajón con los módulos agrupados. */}
      {abierto ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-[var(--scrim)]" onClick={() => setAbierto(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col bg-[var(--nav-bg)] text-[var(--nav-text)] shadow-[4px_0_0_0_var(--nav-accent)]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-display text-[20px] font-bold uppercase leading-none">
                STYLER<span className="text-[var(--nav-accent)]">NOW</span>
              </span>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar menú" className="flex size-11 items-center justify-center border-2 border-[var(--nav-borde)]">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 pb-6">{listaGrupos(true, () => setAbierto(false))}</nav>
          </div>
        </div>
      ) : null}

      {/* Móvil: barra inferior de uso diario. */}
      {inferior.length > 0 ? (
        <nav
          aria-label="Accesos rápidos"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {inferior.map(({ href, etiqueta, Icono }) => {
            const activo = esActivo(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-wide",
                  activo ? "text-[#ff4d00]" : "text-white/70"
                )}
              >
                <Icono className="size-5" aria-hidden />
                {etiqueta}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
