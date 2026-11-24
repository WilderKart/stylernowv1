"use client";

import type { RolPanel } from "@/lib/auth/resolver-contexto";
import { cn } from "@/lib/utils";
import { CalendarDays, Gift, LayoutDashboard, Scissors, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Iconos de la barra lateral (escritorio). Los módulos sin icono propio usan un cuadro de la marca. */
const ICONOS: Record<string, LucideIcon> = {
  "/panel": LayoutDashboard,
  "/panel/agenda": CalendarDays,
  "/panel/staff": Users,
  "/panel/servicios": Scissors,
  "/panel/lealtad": Gift,
  "/panel/verificacion": ShieldCheck,
  "/panel/perfil-publico": Settings,
};

/**
 * Navegación del Panel Negocio (02-UX/09_Business_Panel.md, ADR-006:
 * compartida entre Barbería y Guardian con ítems condicionados por rol).
 *
 * Solo lista módulos que YA EXISTEN como pantalla real — "Sedes" no
 * aparece para Guardian a propósito (administra la suya desde su propio
 * Resumen, no gestiona una lista de sedes ajenas). Cada módulo nuevo agrega
 * su propia entrada aquí, ya filtrada por rol — nunca una lista separada.
 *
 * Escritorio: barra lateral oscura fija. Móvil: franja superior con todos los
 * módulos + barra inferior con los cuatro accesos de uso diario.
 */
export function PanelNav({ rol, prestaServicios = false }: { rol: RolPanel; /** Perfil profesional activo: añade el acceso a la agenda propia (/staff). */ prestaServicios?: boolean }) {
  const pathname = usePathname();

  // Administrador delegado (migración 161): su superficie son los módulos revisados para él. Hoy solo el equipo; el resto del panel
  // sigue siendo del propietario hasta revisar sus políticas (denegado por defecto).
  const items = rol === "ADMIN"
    ? [{ href: "/panel/staff", etiqueta: "Equipo" }, ...(prestaServicios ? [{ href: "/staff", etiqueta: "Mi agenda" }] : [])]
    : [
    { href: "/panel", etiqueta: "Resumen" },
    ...(rol === "BARBERIA" ? [{ href: "/panel/sedes", etiqueta: "Sedes" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/perfil-publico", etiqueta: "Perfil público" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/verificacion", etiqueta: "Verificación" }] : []),
    // Agenda, Staff y Servicios son compartidos entre Barbería y Guardian
    // (ADR-006) — el alcance lo resuelve la propia pantalla vía `permisos`,
    // nunca un ítem de nav distinto por rol.
    { href: "/panel/agenda", etiqueta: "Agenda" },
    { href: "/panel/crm", etiqueta: "Clientes" },
    { href: "/panel/pos", etiqueta: "Caja" },
    { href: "/panel/inventario", etiqueta: "Inventario" },
    { href: "/panel/staff", etiqueta: "Staff" },
    { href: "/panel/servicios", etiqueta: "Servicios" },
    { href: "/panel/reportes", etiqueta: "Reportes" },
    ...(rol === "BARBERIA" ? [{ href: "/panel/promociones", etiqueta: "Promociones" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/ads", etiqueta: "Publicidad" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/lealtad", etiqueta: "Lealtad" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/ia", etiqueta: "IA" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/whatsapp", etiqueta: "WhatsApp" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/politica", etiqueta: "Anticipo y cancelaciones" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/cobros", etiqueta: "Cobros" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/libro", etiqueta: "Libro" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/wallet", etiqueta: "Wallet" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/marca", etiqueta: "Mi Marca" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/suscripcion", etiqueta: "Mi Plan" }] : []),
    { href: "/panel/soporte", etiqueta: "Soporte" },
    ...(prestaServicios && rol === "BARBERIA" ? [{ href: "/staff", etiqueta: "Mi agenda" }] : []),
    ...(rol === "BARBERIA" ? [{ href: "/panel/auditoria", etiqueta: "Auditoría" }] : []),
  ];

  const esActivo = (href: string) => (href === "/panel" ? pathname === "/panel" : pathname.startsWith(href));

  // Barra inferior móvil: los cuatro accesos de uso diario (el resto sigue en la franja superior).
  const inferior =
    rol === "ADMIN"
      ? []
      : [
          { href: "/panel", etiqueta: "Inicio", Icono: LayoutDashboard },
          { href: "/panel/agenda", etiqueta: "Agenda", Icono: CalendarDays },
          { href: "/panel/staff", etiqueta: "Barberos", Icono: Users },
          rol === "BARBERIA"
            ? { href: "/panel/perfil-publico", etiqueta: "Ajustes", Icono: Settings }
            : { href: "/panel/soporte", etiqueta: "Soporte", Icono: Settings },
        ];

  return (
    <>
      {/* Escritorio: barra lateral oscura fija. */}
      <aside aria-label="Navegación del panel" className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#0a0a0a] text-white lg:flex">
        <Link href="/panel" className="px-5 py-5 font-display text-[22px] font-bold uppercase leading-none tracking-tight">
          STYLER<span className="text-[#ff4d00]">NOW</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const activo = esActivo(item.href);
              const Icono = ICONOS[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 border-l-4 px-3 py-2.5 text-[12.5px] font-bold uppercase tracking-wide transition-colors",
                      activo ? "border-[#ff4d00] bg-white/10 text-[#ff4d00]" : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {Icono ? (
                      <Icono className="size-4 shrink-0" aria-hidden />
                    ) : (
                      <span className="w-4 shrink-0 text-center text-[#ff4d00]" aria-hidden>
                        ▪
                      </span>
                    )}
                    {item.etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {rol === "GUARDIAN" ? (
          <p className="border-t border-white/10 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#ff4d00]">Guardian</p>
        ) : null}
      </aside>

      {/* Móvil: franja superior con todos los módulos. */}
      <nav className="border-b border-border-subtle bg-surface lg:hidden">
        <div className="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto px-5 sm:px-10">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 border-b-2 px-3.5 py-3 text-[12.5px] font-bold uppercase tracking-wide transition-colors",
                esActivo(item.href) ? "border-accent text-accent" : "border-transparent text-text-faint hover:text-text-muted"
              )}
            >
              {item.etiqueta}
            </Link>
          ))}
          {rol === "GUARDIAN" ? (
            <span className="ml-auto flex shrink-0 items-center text-[11px] font-bold uppercase tracking-wide text-accent">Guardian</span>
          ) : null}
        </div>
      </nav>

      {/* Móvil: barra inferior de uso diario. */}
      {inferior.length > 0 ? (
        <nav
          aria-label="Accesos rápidos"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t-2 border-[#ff4d00] bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)] lg:hidden"
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
