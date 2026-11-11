"use client";

import { Chip as ChipBase, ChipGroup } from "@/components/brutal";
import { CATEGORIAS_FILTRO as CATEGORIAS } from "./categorias-filtro";
import { HojaFiltros, type FiltrosAvanzados } from "./hoja-filtros";
import { Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const ORDENES = [
  { valor: "CALIFICACION", etiqueta: "Mejor calificadas" },
  { valor: "PRECIO", etiqueta: "Precio" },
  { valor: "RECIENTE", etiqueta: "Nuevos" },
];

export function Filtros() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [texto, setTexto] = useState(params.get("q") ?? "");

  // La URL es la fuente de verdad del estado de búsqueda: se puede compartir y recargar.
  function aplicar(cambios: Record<string, string | null>) {
    const siguiente = new URLSearchParams(params.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") siguiente.delete(clave);
      else siguiente.set(clave, valor);
    }
    startTransition(() => {
      router.replace(`${pathname}?${siguiente.toString()}`, { scroll: false });
    });
  }

  // Búsqueda con retardo: no se dispara una consulta por cada tecla.
  useEffect(() => {
    const actual = params.get("q") ?? "";
    if (texto === actual) return;
    const t = setTimeout(() => aplicar({ q: texto || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const categoria = params.get("categoria");
  const orden = params.get("orden");
  const soloHoy = params.get("hoy") === "1";
  const radio = params.get("radio") ? Number(params.get("radio")) : null;
  const calif = params.get("calif") ? Number(params.get("calif")) : null;
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const cuentaAvanzados = (categoria ? 1 : 0) + (radio !== null ? 1 : 0) + (calif !== null ? 1 : 0) + (soloHoy ? 1 : 0);
  const cercaDeMi = params.get("lat") !== null && params.get("lng") !== null;
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);

  // Proximidad_normalizada (08-Growth-Monetization/01_Marketplace_Algorithm.md)
  // solo tiene efecto real si el Cliente comparte su ubicación — sin este
  // chip, marketplace_buscar() nunca recibía p_lat/p_lng y ese componente
  // del Score quedaba siempre neutral (1 para todos).
  function alternarCercaDeMi() {
    if (cercaDeMi) {
      aplicar({ lat: null, lng: null });
      return;
    }
    if (!("geolocation" in navigator)) {
      setErrorUbicacion("Tu navegador no soporta geolocalización.");
      return;
    }
    setBuscandoUbicacion(true);
    setErrorUbicacion(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscandoUbicacion(false);
        // El modo geo reemplaza al filtro de ciudad por texto — la Biblia
        // describe la Proximidad como una alternativa, no algo que se
        // combine con "buscar por ciudad".
        aplicar({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude), ciudad: null });
      },
      () => {
        setBuscandoUbicacion(false);
        setErrorUbicacion("No pudimos acceder a tu ubicación — revisá los permisos del navegador.");
      },
      { timeout: 8000 }
    );
  }

  // «Aplicar» de la hoja: la distancia necesita la ubicación del cliente (se pide solo si hace falta).
  function aplicarHoja(f: FiltrosAvanzados) {
    const base = {
      categoria: f.categoria,
      calif: f.calif !== null ? String(f.calif) : null,
      hoy: f.hoy ? "1" : null,
    };
    if (f.radio === null) {
      aplicar({ ...base, radio: null });
      setHojaAbierta(false);
      return;
    }
    if (cercaDeMi) {
      aplicar({ ...base, radio: String(f.radio) });
      setHojaAbierta(false);
      return;
    }
    if (!("geolocation" in navigator)) {
      setErrorUbicacion("Tu navegador no soporta geolocalización.");
      return;
    }
    setBuscandoUbicacion(true);
    setErrorUbicacion(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscandoUbicacion(false);
        aplicar({ ...base, radio: String(f.radio), lat: String(pos.coords.latitude), lng: String(pos.coords.longitude), ciudad: null });
        setHojaAbierta(false);
      },
      () => {
        setBuscandoUbicacion(false);
        setErrorUbicacion("No pudimos acceder a tu ubicación — revisa los permisos del navegador para filtrar por distancia.");
      },
      { timeout: 8000 }
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      <label className="sn-input focus-within:shadow-hard">
        <Search aria-hidden className="size-5 shrink-0" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter" />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca por nombre, ciudad o servicio"
          aria-label="Buscar negocios"
        />
      </label>

      {errorUbicacion ? (
        <p role="alert" className="sn-meta !text-danger">
          {errorUbicacion}
        </p>
      ) : null}

      <ChipGroup aria-label="Filtros" className="!pb-0">
        <Chip activo={cercaDeMi} onClick={alternarCercaDeMi}>
          {buscandoUbicacion ? "Ubicándote..." : "Cerca de mí"}
        </Chip>
        <Chip activo={cuentaAvanzados > 0} onClick={() => setHojaAbierta(true)}>
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal aria-hidden className="size-4" strokeWidth={2} strokeLinecap="square" />
            Filtros · {cuentaAvanzados}
          </span>
        </Chip>
        {ORDENES.map((o) => (
          <Chip
            key={o.valor}
            activo={orden === o.valor}
            onClick={() => aplicar({ orden: orden === o.valor ? null : o.valor })}
          >
            {o.etiqueta}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup aria-label="Categorías" className="!pb-0">
        {CATEGORIAS.map((c) => (
          <Chip
            key={c.valor}
            activo={categoria === c.valor}
            onClick={() => aplicar({ categoria: categoria === c.valor ? null : c.valor })}
          >
            {c.etiqueta}
          </Chip>
        ))}
      </ChipGroup>

      {hojaAbierta ? (
        <HojaFiltros
          inicial={{ categoria, radio: radio !== null && Number.isFinite(radio) ? radio : null, calif: calif !== null && Number.isFinite(calif) ? calif : null, hoy: soloHoy }}
          tieneUbicacion={cercaDeMi}
          coords={cercaDeMi ? { lat: Number(params.get("lat")), lng: Number(params.get("lng")) } : null}
          onCerrar={() => setHojaAbierta(false)}
          onAplicar={aplicarHoja}
        />
      ) : null}
    </div>
  );
}

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <ChipBase selected={activo} onClick={onClick} className="!min-h-12 max-w-full !whitespace-normal">
      {children}
    </ChipBase>
  );
}
