"use client";

import { buscarEnPanel, listarActividadPanel, type ActividadItem, type RespuestaBusqueda } from "@/app/panel/buscador-actions";
import { cn } from "@/lib/utils";
import { Bell, CalendarDays, Loader2, Search, SearchX, Users, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Buscador y campana de actividad del panel (spa, salón y uñas). Presentación: los resultados y la actividad llegan de
 * acciones de servidor que resuelven el negocio y el rol desde la sesión (el navegador nunca envía el negocio).
 */

type Estilo = "suave" | "clasico";
/** Mismas funciones en los dos diseños: «suave» (spa, salón, uñas) y «clasico» (barbería y tattoo: esquinas rectas y borde grueso). */
const CLASES = {
  suave: {
    btn: "pn-pill grid size-11 place-items-center bg-[var(--bg)] text-[var(--text)] shadow-[var(--sn-shadow-hard-sm)]",
    campo: "pn-pill bg-[var(--bg)] text-[var(--text)] shadow-[var(--sn-shadow-hard-sm)] ring-1 ring-[var(--line)] outline-none placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
    campoMovil: "pn-pill bg-[var(--bg)] text-[var(--text)] ring-1 ring-[var(--line)] outline-none placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
    flotante: "pn-card bg-[var(--bg)] text-[var(--text)] shadow-[var(--sn-shadow-hard)] ring-1 ring-[var(--line)]",
    opcion: "pn-card",
    chip: "pn-chip bg-[var(--pn-amber-soft)] text-[var(--pn-amber)]",
    pildora: "pn-pill",
    cerrar: "pn-pill bg-[var(--bg)] ring-1 ring-[var(--line)]",
  },
  clasico: {
    btn: "grid size-11 place-items-center border-2 border-border bg-app text-text hover:bg-surface",
    campo: "border-2 border-border bg-app text-text outline-none placeholder:text-text-muted focus-visible:border-ink",
    campoMovil: "border-2 border-border bg-app text-text outline-none placeholder:text-text-muted focus-visible:border-ink",
    flotante: "border-2 border-ink bg-app text-text shadow-hard",
    opcion: "",
    chip: "bg-signal text-ink font-mono uppercase",
    pildora: "",
    cerrar: "border-2 border-border bg-app",
  },
} as const;

const ICONOS: Record<string, LucideIcon> = { clientes: Users, reservas: CalendarDays };

// ───────────────────────────── Buscador ─────────────────────────────
export function BuscadorPanel({ className, estilo = "suave" }: { className?: string; estilo?: Estilo }) {
  const k = CLASES[estilo];
  const router = useRouter();
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [movilAbierto, setMovilAbierto] = useState(false);
  const [datos, setDatos] = useState<{ q: string; r: RespuestaBusqueda | null; error: boolean } | null>(null);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const entradaEscritorio = useRef<HTMLInputElement>(null);
  const entradaMovil = useRef<HTMLInputElement>(null);
  const id = useId();

  const consulta = q.trim();
  const valida = consulta.length >= 2;
  const vigente = valida && datos?.q === consulta;
  const cargando = valida && !vigente;

  // Búsqueda en vivo con espera corta entre teclas; se descartan respuestas de consultas antiguas.
  useEffect(() => {
    if (!valida) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      const res = await buscarEnPanel(consulta);
      if (cancelado) return;
      setDatos({ q: consulta, r: res.ok ? res.data : null, error: !res.ok });
      setActivo(0);
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [consulta, valida]);

  // Atajo Ctrl/⌘ + K y cierre al hacer clic fuera.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) entradaEscritorio.current?.focus();
        else setMovilAbierto(true);
      }
    };
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fuera);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", fuera);
    };
  }, []);

  useEffect(() => {
    if (movilAbierto) entradaMovil.current?.focus();
  }, [movilAbierto]);

  const planos = useMemo(() => (vigente && datos?.r ? datos.r.grupos.flatMap((g) => g.items) : []), [vigente, datos]);

  const ir = useCallback(
    (href: string) => {
      setAbierto(false);
      setMovilAbierto(false);
      setQ("");
      router.push(href);
    },
    [router],
  );

  function alTeclear(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setAbierto(false);
      setMovilAbierto(false);
    } else if (e.key === "ArrowDown" && planos.length) {
      e.preventDefault();
      setActivo((a) => (a + 1) % planos.length);
    } else if (e.key === "ArrowUp" && planos.length) {
      e.preventDefault();
      setActivo((a) => (a - 1 + planos.length) % planos.length);
    } else if (e.key === "Enter" && planos[activo]) {
      e.preventDefault();
      ir(planos[activo].href);
    }
  }

  const resultados = (
    <div id={`${id}-lista`} role="listbox" aria-label="Resultados de la búsqueda" className="max-h-[min(70dvh,520px)] overflow-y-auto overscroll-contain p-2">
      {!valida ? (
        <p className="px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">Escribe al menos 2 letras. Busca clientes, citas, servicios, equipo, sedes y configuraciones.</p>
      ) : cargando ? (
        <p className="flex items-center justify-center gap-2 px-3 py-6 text-[13px] text-[var(--text-muted)]" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando…
        </p>
      ) : datos?.error ? (
        <p role="alert" className="px-3 py-6 text-center text-[13px] font-semibold text-[var(--pn-rose)]">
          No pudimos buscar ahora. Inténtalo de nuevo.
        </p>
      ) : planos.length === 0 ? (
        <div className="px-3 py-8 text-center" role="status">
          <SearchX className="mx-auto mb-2 size-6 text-[var(--text-faint)]" aria-hidden />
          <p className="text-[14px] font-bold text-[var(--text)]">No hay resultados que coincidan con tu búsqueda</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Revisa la ortografía o prueba con otra palabra (nombre, teléfono, servicio).</p>
        </div>
      ) : (
        <>
          {datos?.r?.hayAproximados ? <p className="px-3 pb-1 pt-1 text-[12px] text-[var(--text-muted)]">Mostrando también resultados cercanos a «{consulta}».</p> : null}
          {(() => {
            let n = -1;
            return datos!.r!.grupos.map((g) => {
              const Icono = ICONOS[g.clave];
              return (
                <div key={g.clave} className="mb-1">
                  <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11.5px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                    {Icono ? <Icono className="size-3.5" aria-hidden /> : null}
                    {g.titulo}
                  </p>
                  {g.items.map((it) => {
                    n += 1;
                    const idx = n;
                    return (
                      <button
                        key={g.clave + it.id}
                        type="button"
                        role="option"
                        aria-selected={idx === activo}
                        onMouseEnter={() => setActivo(idx)}
                        onClick={() => ir(it.href)}
                        className={cn(k.opcion, "flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left", idx === activo ? "bg-[var(--surface-2)]" : "bg-transparent")}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-[var(--text)]">{it.titulo}</span>
                          <span className="block truncate text-[12px] text-[var(--text-muted)]">{it.detalle}</span>
                        </span>
                        {it.aproximado ? <span className={cn(k.chip, "shrink-0 px-2 py-0.5 text-[11px] font-semibold")}>Parecido</span> : null}
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Escritorio: campo en línea con lista desplegable */}
      <div ref={caja} className={cn("relative hidden w-full max-w-[460px] lg:block", className)}>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
        <input
          ref={entradaEscritorio}
          type="search"
          role="combobox"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
          placeholder="Buscar cliente, cita o servicio…"
          aria-label="Buscar en el panel"
          aria-expanded={abierto}
          aria-controls={`${id}-lista`}
          autoComplete="off"
          className={cn(k.campo, "h-12 w-full pl-11 pr-14 text-[14px]")}
        />
        <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] xl:block">Ctrl K</kbd>
        {abierto && consulta.length > 0 ? (
          <div className={cn(k.flotante, "absolute left-0 right-0 top-[calc(100%+8px)] z-50")}>{resultados}</div>
        ) : null}
      </div>

      {/* Móvil: botón + hoja de búsqueda a pantalla completa */}
      <button
        type="button"
        onClick={() => setMovilAbierto(true)}
        aria-label="Buscar en el panel"
        className={cn(k.btn, "lg:hidden")}
      >
        <Search className="size-5" aria-hidden />
      </button>
      {movilAbierto ? (
        <div role="dialog" aria-modal="true" aria-label="Buscar en el panel" className="fixed inset-0 z-[60] flex flex-col bg-[var(--app-bg)] text-[var(--text)] lg:hidden">
          <div className="flex items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
              <input
                ref={entradaMovil}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={alTeclear}
                placeholder="Buscar cliente, cita o servicio…"
                aria-label="Buscar en el panel"
                aria-controls={`${id}-lista`}
                autoComplete="off"
                enterKeyHint="search"
                className={cn(k.campoMovil, "h-12 w-full pl-11 pr-4 text-[16px]")}
              />
            </div>
            <button type="button" onClick={() => setMovilAbierto(false)} className={cn(k.cerrar, "grid size-12 shrink-0 place-items-center")} aria-label="Cerrar búsqueda">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className={cn(k.flotante, "mx-3 mb-3 min-h-0 flex-1 overflow-hidden [&>div]:max-h-full [&>div]:h-full")}>{resultados}</div>
        </div>
      ) : null}
    </>
  );
}

// ───────────────────────────── Campana ─────────────────────────────
const CLAVE_VISTO = "sn_actividad_visto";
const leerVisto = () => {
  try {
    return Number(window.localStorage.getItem(CLAVE_VISTO)) || 0;
  } catch {
    return 0;
  }
};
const marcarVisto = () => {
  try {
    window.localStorage.setItem(CLAVE_VISTO, String(Date.now()));
  } catch {
    /* solo comodidad visual */
  }
};
function hace(iso: string) {
  const min = Math.max(Math.round((Date.now() - new Date(iso).getTime()) / 60000), 0);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return `Hace ${d} ${d === 1 ? "día" : "días"}`;
}

export function CampanaPanel({ className, estilo = "suave" }: { className?: string; estilo?: Estilo }) {
  const k = CLASES[estilo];
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<ActividadItem[] | null>(null);
  const [error, setError] = useState(false);
  const [visto, setVisto] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const idPanel = useId();

  const cargar = useCallback(async () => {
    const res = await listarActividadPanel();
    if (res.ok) {
      setItems(res.data);
      setError(false);
    } else setError(true);
    setVisto(leerVisto());
  }, []);

  useEffect(() => {
    let vivo = true;
    const ciclo = async () => {
      if (vivo && document.visibilityState === "visible") await cargar();
    };
    void ciclo();
    const t = setInterval(ciclo, 90000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const sinLeer = (items ?? []).filter((i) => new Date(i.fecha).getTime() > visto).length;

  function alternar() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente) {
      void cargar();
    } else {
      marcarVisto();
      setVisto(Date.now());
    }
  }

  return (
    <div ref={caja} className={cn("relative", className)}>
      <button
        type="button"
        onClick={alternar}
        aria-label={sinLeer > 0 ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={`${idPanel}-panel`}
        className={cn(k.btn, "relative lg:size-12")}
      >
        <Bell className="size-5" aria-hidden />
        {sinLeer > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[var(--pn-rose,var(--danger))] px-1 text-[10.5px] font-extrabold leading-[18px] text-white" aria-hidden>
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        ) : null}
      </button>
      {abierto ? (
        <div
          id={`${idPanel}-panel`}
          role="dialog"
          aria-label="Notificaciones"
          className={cn(k.flotante, "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-50 lg:absolute lg:inset-x-auto lg:right-0 lg:top-[calc(100%+8px)] lg:w-[400px]")}
        >
          <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-4">
            <h2 className="text-[16px] font-extrabold">Notificaciones</h2>
            <button
              type="button"
              onClick={() => {
                marcarVisto();
                setVisto(Date.now());
              }}
              disabled={sinLeer === 0}
              className="min-h-9 text-[12.5px] font-semibold text-[var(--accent-text)] disabled:opacity-50"
            >
              Marcar como leídas
            </button>
          </div>
          <div className="max-h-[min(65dvh,480px)] overflow-y-auto overscroll-contain px-2 pb-2">
            {items === null && !error ? (
              <p className="flex items-center justify-center gap-2 px-3 py-8 text-[13px] text-[var(--text-muted)]" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando…
              </p>
            ) : error ? (
              <p role="alert" className="px-3 py-8 text-center text-[13px] font-semibold text-[var(--pn-rose)]">
                No pudimos cargar la actividad.
              </p>
            ) : items!.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-[var(--text-muted)]">Todavía no hay actividad en tu panel.</p>
            ) : (
              <ul className="flex flex-col">
                {items!.map((n) => {
                  const nueva = new Date(n.fecha).getTime() > visto;
                  return (
                    <li key={n.clave}>
                      <button
                        type="button"
                        onClick={() => {
                          setAbierto(false);
                          marcarVisto();
                          setVisto(Date.now());
                          router.push(n.href);
                        }}
                        className={cn(k.opcion, "flex min-h-14 w-full items-start gap-3 px-2.5 py-2.5 text-left hover:bg-[var(--surface)]")}
                      >
                        <span className={cn(k.pildora, "mt-0.5 grid size-9 shrink-0 place-items-center")} style={{ background: `var(--pn-${n.tono}-soft, var(--signal))`, color: `var(--pn-${n.tono}, var(--ink))` }}>
                          <Bell className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-bold">{n.titulo}</span>
                            <span className="shrink-0 text-[11px] text-[var(--text-faint)]">{hace(n.fecha)}</span>
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-muted)]">{n.detalle}</span>
                        </span>
                        {nueva ? <span className="mt-2 size-2 shrink-0 rounded-full bg-[var(--pn-violet,var(--ink))]" aria-label="Sin leer" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
