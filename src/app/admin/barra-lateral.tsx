"use client";

import { cerrarSesion } from "@/app/perfil/actions";
import { cn } from "@/lib/utils";
import {
  Activity,
  BookOpen,
  Crown,
  Gift,
  House,
  Layers,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  Scale,
  Settings,
  ShieldAlert,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export type ContadoresAdmin = { negociosPendientes: number; ticketsAbiertos: number; resenasReportadas: number };

type Item = { href: string; etiqueta: string; icono: React.ComponentType<{ className?: string }>; contador?: keyof ContadoresAdmin };

const GRUPOS: { titulo?: string; items: Item[] }[] = [
  { items: [{ href: "/admin", etiqueta: "Inicio", icono: House }] },
  {
    titulo: "Operación",
    items: [
      { href: "/admin/negocios", etiqueta: "Negocios", icono: Store, contador: "negociosPendientes" },
      { href: "/admin/soporte", etiqueta: "Soporte", icono: LifeBuoy, contador: "ticketsAbiertos" },
      { href: "/admin/moderacion", etiqueta: "Moderación", icono: ShieldAlert, contador: "resenasReportadas" },
    ],
  },
  {
    titulo: "Ingresos y producto",
    items: [
      { href: "/admin/planes", etiqueta: "Planes y suscripciones", icono: Layers },
      { href: "/admin/lealtad", etiqueta: "Lealtad", icono: Gift },
      { href: "/admin/ai", etiqueta: "IA Center", icono: Sparkles },
      { href: "/admin/whatsapp", etiqueta: "WhatsApp", icono: MessageCircle },
    ],
  },
  {
    titulo: "Gobierno",
    items: [
      { href: "/admin/reglas", etiqueta: "Reglas y políticas", icono: Scale },
      { href: "/admin/libro", etiqueta: "Libro contable", icono: BookOpen },
      { href: "/admin/auditoria", etiqueta: "Auditoría", icono: Activity },
      { href: "/admin/configuracion", etiqueta: "Configuración", icono: Settings },
    ],
  },
];

function esActivo(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/admin" className="font-display text-[26px] font-black uppercase leading-none tracking-tight text-white">
      Styler<span className="text-[#ff4d00]">Now.</span>
    </Link>
  );
}

function Contenido({
  email,
  nombre,
  contadores,
  alNavegar,
}: {
  email: string;
  nombre: string;
  contadores: ContadoresAdmin;
  alNavegar?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [saliendo, iniciarSalida] = useTransition();
  const iniciales = (nombre || email || "SU").trim().slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6">
        <Logo />
        <div className="mt-5 flex items-center gap-2 bg-[#ff4d00] px-3 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-white">
          <Crown className="size-4" aria-hidden />
          Super Admin
        </div>
      </div>

      <nav aria-label="Secciones del Super Admin" className="mt-5 flex-1 overflow-y-auto px-3 pb-4">
        {GRUPOS.map((g, i) => (
          <div key={g.titulo ?? i} className={cn(i > 0 && "mt-4")}>
            {g.titulo && (
              <p className="px-3 pb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{g.titulo}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const activo = esActivo(pathname, it.href);
                const n = it.contador ? contadores[it.contador] : 0;
                const Icono = it.icono;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={alNavegar}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 px-3 py-2 text-[14px] font-semibold transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ff4d00]",
                        activo ? "bg-[#ff4d00] text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icono className="size-[18px] shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{it.etiqueta}</span>
                      {n > 0 && (
                        <span
                          className={cn(
                            "min-w-6 px-1.5 py-0.5 text-center font-mono text-[11px] font-bold",
                            activo ? "bg-white text-[#0a0a0a]" : "bg-[#ff4d00] text-white",
                          )}
                          aria-label={`${n} pendientes`}
                        >
                          {n > 99 ? "99+" : n}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/15 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center border-2 border-[#ff4d00] font-display text-[14px] font-black text-white">
            {iniciales}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-bold text-white">Super Admin</p>
            <p className="truncate text-[11.5px] text-white/60">{email}</p>
          </div>
          <button
            type="button"
            disabled={saliendo}
            onClick={() =>
              iniciarSalida(async () => {
                await cerrarSesion();
                router.replace("/login");
                router.refresh();
              })
            }
            className="grid size-10 shrink-0 place-items-center text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Navegación del Super Admin: barra vertical fija en escritorio (lg+) y, en móvil/tablet,
 * barra superior con botón de menú que abre la misma navegación como panel deslizable.
 */
export function BarraLateralAdmin(props: { email: string; nombre: string; contadores: ContadoresAdmin }) {
  const pathname = usePathname();
  // El menú queda abierto solo en la ruta donde se abrió: al navegar se cierra solo (sin efecto extra).
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;
  const setAbierto = (v: boolean) => setAbiertoEn(v ? pathname : null);

  // Escape cierra; mientras está abierto, la página de fondo no se desplaza.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  const pendientes = props.contadores.negociosPendientes + props.contadores.ticketsAbiertos + props.contadores.resenasReportadas;

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-[#0a0a0a] lg:block">
        <Contenido {...props} />
      </aside>

      {/* Móvil / tablet */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#0a0a0a] px-4 lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="relative grid size-11 place-items-center text-white"
          aria-label="Abrir menú"
          aria-expanded={abierto}
          aria-controls="menu-admin-movil"
        >
          <Menu className="size-6" aria-hidden />
          {pendientes > 0 && <span className="absolute right-2 top-2 size-2.5 bg-[#ff4d00]" aria-hidden />}
        </button>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del Super Admin">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setAbierto(false)} aria-label="Cerrar menú" />
          <div id="menu-admin-movil" className="absolute inset-y-0 left-0 w-[85%] max-w-[300px] bg-[#0a0a0a] shadow-2xl">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="absolute right-2 top-4 z-10 grid size-11 place-items-center text-white"
              aria-label="Cerrar menú"
            >
              <X className="size-6" aria-hidden />
            </button>
            <Contenido {...props} alNavegar={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  );
}
