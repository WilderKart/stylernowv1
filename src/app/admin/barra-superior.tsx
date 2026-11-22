"use client";

import { Bell, CalendarDays, LifeBuoy, Search, ShieldAlert, Store, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { buscarGlobal, type ResultadoBusqueda } from "./barra-actions";
import type { ContadoresAdmin } from "./barra-lateral";

type Item = { href: string; titulo: string; detalle: string; icono: typeof Store; grupo: string };

function aplanar(r: ResultadoBusqueda): Item[] {
  return [
    ...r.negocios.map((n) => ({ href: `/admin/negocios?id=${n.id}`, titulo: n.nombre, detalle: n.detalle, icono: Store, grupo: "Negocios" })),
    ...r.usuarios.map((u) => ({ href: `/admin/usuarios/${u.id}`, titulo: u.nombre || "Sin nombre", detalle: u.detalle ?? "", icono: User, grupo: "Usuarios" })),
    ...r.reservas.map((x) => ({ href: `/admin/negocios?q=${encodeURIComponent(x.nombre)}`, titulo: `Reserva ${x.id.slice(0, 8)} · ${x.nombre}`, detalle: x.detalle, icono: CalendarDays, grupo: "Reservas" })),
  ];
}

function Buscador() {
  const router = useRouter();
  const pathname = usePathname();
  const idLista = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(0);
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname && q.trim().length >= 2;
  const contenedor = useRef<HTMLDivElement>(null);
  const ultimo = useRef(0);

  // Búsqueda con espera corta: solo se aplica la respuesta de la última consulta.
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) return;
    const n = ++ultimo.current;
    const t = setTimeout(async () => {
      setCargando(true);
      const r = await buscarGlobal(texto);
      if (n !== ultimo.current) return;
      setCargando(false);
      setItems(r ? aplanar(r) : []);
      setActivo(0);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbiertoEn(null);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const lista = items ?? [];
  const ir = (href: string) => {
    setAbiertoEn(null);
    setQ("");
    setItems(null);
    router.push(href);
  };

  return (
    <div ref={contenedor} className="relative min-w-0 flex-1">
      <label className="flex h-11 items-center gap-2 border-2 border-border bg-bg px-3 focus-within:border-accent">
        <Search className="size-4 shrink-0 text-text-faint" aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAbiertoEn(pathname);
          }}
          onFocus={() => setAbiertoEn(pathname)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAbiertoEn(null);
            if (!abierto || lista.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((a) => (a + 1) % lista.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => (a - 1 + lista.length) % lista.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              ir(lista[activo].href);
            }
          }}
          placeholder="Buscar negocio, usuario o reserva…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-faint"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-label="Buscar en toda la plataforma"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); setItems(null); }} className="grid size-7 place-items-center text-text-faint" aria-label="Limpiar búsqueda">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>

      {abierto && (
        <div id={idLista} role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto border-2 border-border bg-app shadow-[4px_4px_0_0_var(--shadow-ink)]">
          {cargando && lista.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-text-faint">Buscando…</p>
          ) : items && lista.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-text-faint">Sin resultados para “{q.trim()}”.</p>
          ) : (
            lista.map((it, i) => (
              <div key={it.href + i}>
                {(i === 0 || lista[i - 1].grupo !== it.grupo) && (
                  <p className="border-t border-border-subtle px-4 pb-1 pt-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-text-faint first:border-t-0">
                    {it.grupo}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activo}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => ir(it.href)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === activo ? "bg-surface" : ""}`}
                >
                  <it.icono className="size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-text">{it.titulo}</span>
                    {it.detalle && <span className="block truncate text-[12px] text-text-muted">{it.detalle}</span>}
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Campana({ contadores }: { contadores: ContadoresAdmin }) {
  const pathname = usePathname();
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbiertoEn(null);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const avisos = [
    { n: contadores.negociosPendientes, texto: (n: number) => `${n} ${n === 1 ? "negocio espera" : "negocios esperan"} aprobación`, href: "/admin/negocios", icono: Store },
    { n: contadores.ticketsAbiertos, texto: (n: number) => `${n} ${n === 1 ? "ticket abierto" : "tickets abiertos"} de soporte`, href: "/admin/soporte", icono: LifeBuoy },
    { n: contadores.resenasReportadas, texto: (n: number) => `${n} ${n === 1 ? "reseña reportada" : "reseñas reportadas"}`, href: "/admin/moderacion", icono: ShieldAlert },
  ].filter((a) => a.n > 0);
  const total = avisos.reduce((a, b) => a + b.n, 0);

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbiertoEn(abierto ? null : pathname)}
        className="relative grid size-11 place-items-center border-2 border-border bg-bg text-text hover:border-accent"
        aria-label={total > 0 ? `Pendientes: ${total}` : "Sin pendientes"}
        aria-expanded={abierto}
      >
        <Bell className="size-5" aria-hidden />
        {total > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center bg-accent px-1 font-mono text-[10.5px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
      {abierto && (
        <div className="absolute right-0 top-full z-40 mt-1 w-[min(320px,calc(100vw-2rem))] border-2 border-border bg-app shadow-[4px_4px_0_0_var(--shadow-ink)]">
          <p className="border-b border-border-subtle px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wide text-text">Pendientes</p>
          {avisos.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-text-muted">Todo al día: no hay pendientes.</p>
          ) : (
            avisos.map((a) => (
              <Link key={a.href} href={a.href} onClick={() => setAbiertoEn(null)} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
                <a.icono className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="text-[13.5px] font-semibold text-text">{a.texto(a.n)}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Barra superior del contenido: buscador global + pendientes. Se ve en todas las secciones. */
export function BarraSuperiorAdmin({ contadores }: { contadores: ContadoresAdmin }) {
  return (
    <div className="sticky top-14 z-20 border-b-2 border-border bg-app/95 backdrop-blur lg:top-0">
      <div className="flex items-center gap-2 px-4 py-2.5 sm:px-8 lg:px-10">
        <Buscador />
        <Campana contadores={contadores} />
      </div>
    </div>
  );
}
