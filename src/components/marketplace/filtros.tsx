"use client";

import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * Catálogo de verticales. El Glossary es explícito: "barbería" nunca es un tipo de
 * dato, solo un valor — por eso vive en una constante y no en un enum de base.
 */
const CATEGORIAS = [
  { valor: "barberia", etiqueta: "Barbería" },
  { valor: "salon", etiqueta: "Salón" },
  { valor: "spa", etiqueta: "Spa" },
  { valor: "unas", etiqueta: "Uñas" },
  { valor: "estetica", etiqueta: "Estética" },
];

const ORDENES = [
  { valor: "CALIFICACION", etiqueta: "Mejor calificadas" },
  { valor: "PRECIO", etiqueta: "Precio" },
  { valor: "RECIENTE", etiqueta: "Nuevos" },
];

function Chip({
  activo,
  children,
  onClick,
}: {
  activo: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
        activo
          ? "border-accent bg-accent-soft text-accent"
          : "border-border text-text-muted hover:border-accent/40 hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

export function Filtros({ ciudades }: { ciudades: string[] }) {
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
  const ciudad = params.get("ciudad");
  const soloHoy = params.get("hoy") === "1";
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

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex h-[50px] items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 focus-within:border-accent/60">
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="#6b6862"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca tu barbería, salón o spa..."
          aria-label="Buscar negocios"
          className="w-full bg-transparent text-[13.5px] text-text outline-none placeholder:text-text-faint"
        />
      </div>

      {errorUbicacion ? <p className="text-[11.5px] text-danger">{errorUbicacion}</p> : null}

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        <Chip activo={cercaDeMi} onClick={alternarCercaDeMi}>
          {buscandoUbicacion ? "Ubicándote..." : "Cerca de mí"}
        </Chip>
        <Chip activo={soloHoy} onClick={() => aplicar({ hoy: soloHoy ? null : "1" })}>
          Disponible hoy
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
        {CATEGORIAS.map((c) => (
          <Chip
            key={c.valor}
            activo={categoria === c.valor}
            onClick={() => aplicar({ categoria: categoria === c.valor ? null : c.valor })}
          >
            {c.etiqueta}
          </Chip>
        ))}
      </div>

      {ciudades.length > 1 && !cercaDeMi ? (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
          <Chip activo={!ciudad} onClick={() => aplicar({ ciudad: null })}>
            Todas las ciudades
          </Chip>
          {ciudades.map((c) => (
            <Chip key={c} activo={ciudad === c} onClick={() => aplicar({ ciudad: c })}>
              {c}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
