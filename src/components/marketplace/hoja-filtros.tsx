"use client";

import { Chip, Switch } from "@/components/brutal";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { contarResultadosAction } from "./actions";
import { CATEGORIAS_FILTRO } from "./categorias-filtro";

const DISTANCIAS = [
  { km: 0.5, etiqueta: "≤ 0,5 KM" },
  { km: 1, etiqueta: "≤ 1 KM" },
  { km: 2, etiqueta: "≤ 2 KM" },
  { km: 5, etiqueta: "≤ 5 KM" },
  { km: null, etiqueta: "SIN LÍMITE" },
];
const CALIFS = [
  { valor: null, etiqueta: "TODAS" },
  { valor: 3, etiqueta: "3+" },
  { valor: 4, etiqueta: "4+" },
  { valor: 4.5, etiqueta: "4,5+" },
];

export interface FiltrosAvanzados {
  categoria: string | null;
  radio: number | null;
  calif: number | null;
  hoy: boolean;
}

/** Hoja inferior de filtros (C06). El borrador es local; «Aplicar» lo vuelca a la URL vía `onAplicar`. */
export function HojaFiltros({
  inicial,
  tieneUbicacion,
  coords,
  onCerrar,
  onAplicar,
}: {
  inicial: FiltrosAvanzados;
  tieneUbicacion: boolean;
  coords: { lat: number; lng: number } | null;
  onCerrar: () => void;
  onAplicar: (f: FiltrosAvanzados) => void;
}) {
  const [f, setF] = useState(inicial);
  const [total, setTotal] = useState<number | null>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  const idxDist = Math.max(
    0,
    DISTANCIAS.findIndex((d) => d.km === f.radio)
  );
  const cuenta = (f.categoria ? 1 : 0) + (f.radio !== null ? 1 : 0) + (f.calif !== null ? 1 : 0) + (f.hoy ? 1 : 0);

  useEffect(() => {
    cerrarRef.current?.focus();
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = alt;
      window.removeEventListener("keydown", tecla);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el cierre es estable en la práctica; solo se monta una vez
  }, []);

  // Conteo en vivo con retardo; ignora respuestas viejas.
  useEffect(() => {
    let vigente = true;
    const t = setTimeout(async () => {
      const n = await contarResultadosAction({
        categoria: f.categoria ?? undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        radioKm: f.radio ?? undefined,
        califMin: f.calif ?? undefined,
        abiertoHoy: f.hoy,
      }).catch(() => null);
      if (vigente) setTotal(n);
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [f, coords]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Cerrar filtros" tabIndex={-1} onClick={onCerrar} className="absolute inset-0 bg-[var(--scrim)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className="sn-sheet relative max-h-[88dvh] max-w-xl overflow-x-hidden overflow-y-auto pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]"
      >
        <div className="sn-sheet__grab" />
        <div className="sn-sheet__head">
          <h2 className="section m-0">
            Filtros <span className="text-signal">· {cuenta}</span>
          </h2>
          <button ref={cerrarRef} type="button" aria-label="Cerrar" onClick={onCerrar} className="sn-iconbtn">
            <X aria-hidden className="size-5" strokeWidth={2} strokeLinecap="square" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <span className="sn-label mb-2 block">01 / Categoría</span>
            <div className="p-chips !px-0 !pb-0">
              {CATEGORIAS_FILTRO.map((c) => (
                <Chip
                  key={c.valor}
                  selected={f.categoria === c.valor}
                  onClick={() => setF({ ...f, categoria: f.categoria === c.valor ? null : c.valor })}
                  className="!min-h-12"
                >
                  {c.etiqueta}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="filtro-distancia" className="sn-label mb-2 flex flex-wrap justify-between gap-2">
              <span>02 / Distancia</span>
              <span className="text-signal">{DISTANCIAS[idxDist].etiqueta}</span>
            </label>
            <input
              id="filtro-distancia"
              type="range"
              min={0}
              max={4}
              step={1}
              value={idxDist}
              onChange={(e) => setF({ ...f, radio: DISTANCIAS[Number(e.target.value)].km })}
              className="h-12 w-full accent-[var(--signal)]"
            />
            <div className="sn-meta flex justify-between">
              <span>0,5</span>
              <span>1</span>
              <span>2</span>
              <span>5</span>
              <span>10+ KM</span>
            </div>
            {f.radio !== null && !tieneUbicacion ? (
              <p className="sn-meta mt-2">Al aplicar te pediremos tu ubicación para medir la distancia.</p>
            ) : null}
          </div>

          <div>
            <span className="sn-label mb-2 block">03 / Calificación mínima</span>
            <div role="radiogroup" aria-label="Calificación mínima" className="sn-seg w-full">
              {CALIFS.map((c) => (
                <button
                  key={c.etiqueta}
                  type="button"
                  role="radio"
                  aria-checked={f.calif === c.valor}
                  onClick={() => setF({ ...f, calif: c.valor })}
                  className="min-w-0 flex-1"
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-2 border-line p-3">
            <span className="min-w-0">
              <span className="sn-label block">04 / Abierto ahora</span>
              <span className="body-sm block">Solo negocios con horario disponible hoy.</span>
            </span>
            <Switch checked={f.hoy} onCheckedChange={(v) => setF({ ...f, hoy: v })} aria-label="Abierto ahora" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[auto_1fr] gap-3">
          <button type="button" className="sn-btn sn-btn--secondary" onClick={() => setF({ categoria: null, radio: null, calif: null, hoy: false })}>
            Limpiar
          </button>
          <button type="button" className="sn-btn sn-btn--primary min-w-0" onClick={() => onAplicar(f)}>
            Aplicar{total !== null ? ` · ${total}` : ""} ↗
          </button>
        </div>
      </div>
    </div>
  );
}
