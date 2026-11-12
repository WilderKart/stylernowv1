"use client";

import { Chip, Switch } from "@/components/brutal";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/proveedor";
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
  const t = useT();
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
  const sinConteo = f.radio !== null && !coords;
  useEffect(() => {
    let vigente = true;
    // Con distancia pero sin ubicación el conteo ignoraría el radio (número falso): se oculta hasta tenerla.
    if (f.radio !== null && !coords) {
      return () => {
        vigente = false;
      };
    }
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
      <button type="button" aria-label={t("hoja.cerrar_filtros")} tabIndex={-1} onClick={onCerrar} className="absolute inset-0 bg-[var(--scrim)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("filtros.filtros")}
        className="sn-sheet relative max-h-[88dvh] max-w-xl overflow-x-hidden overflow-y-auto pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]"
      >
        <div className="sn-sheet__grab" />
        <div className="sn-sheet__head">
          <h2 className="section m-0">
            {t("filtros.filtros")} <span className="text-signal">· {cuenta}</span>
          </h2>
          <button ref={cerrarRef} type="button" aria-label={t("hoja.cerrar")} onClick={onCerrar} className="sn-iconbtn">
            <X aria-hidden className="size-5" strokeWidth={2} strokeLinecap="square" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <span className="sn-label mb-2 block">{t("hoja.categoria")}</span>
            <div className="p-chips !px-0 !pb-0">
              {CATEGORIAS_FILTRO.map((c) => (
                <Chip
                  key={c.valor}
                  selected={f.categoria === c.valor}
                  onClick={() => setF({ ...f, categoria: f.categoria === c.valor ? null : c.valor })}
                  className="!min-h-12"
                >
                  {t(c.etiqueta)}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="filtro-distancia" className="sn-label mb-2 flex flex-wrap justify-between gap-2">
              <span>{t("hoja.distancia")}</span>
              <span className="text-signal">{DISTANCIAS[idxDist].km === null ? t("hoja.sin_limite") : DISTANCIAS[idxDist].etiqueta}</span>
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
              <p className="sn-meta mt-2">{t("hoja.pedir_ubicacion")}</p>
            ) : null}
          </div>

          <div>
            <span className="sn-label mb-2 block">{t("hoja.calif_min_sec")}</span>
            <div role="radiogroup" aria-label={t("hoja.calif_min")} className="sn-seg w-full">
              {CALIFS.map((c) => (
                <button
                  key={c.etiqueta}
                  type="button"
                  role="radio"
                  aria-checked={f.calif === c.valor}
                  onClick={() => setF({ ...f, calif: c.valor })}
                  className="min-w-0 flex-1"
                >
                  {c.valor === null ? t("hoja.todas") : c.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-2 border-line p-3">
            <span className="min-w-0">
              <span className="sn-label block">{t("hoja.abierto_ahora_sec")}</span>
              <span className="body-sm block">{t("hoja.solo_horario")}</span>
            </span>
            <Switch checked={f.hoy} onCheckedChange={(v) => setF({ ...f, hoy: v })} aria-label={t("hoja.abierto_ahora")} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[auto_1fr] gap-3">
          <button type="button" className="sn-btn sn-btn--secondary" onClick={() => setF({ categoria: null, radio: null, calif: null, hoy: false })}>
            {t("hoja.limpiar")}
          </button>
          <button type="button" className="sn-btn sn-btn--primary min-w-0" onClick={() => onAplicar(f)}>
            {t("hoja.aplicar")}{total !== null && !sinConteo ? ` · ${total}` : ""} ↗
          </button>
        </div>
      </div>
    </div>
  );
}
