"use client";

import { Chip as ChipBase, ChipGroup } from "@/components/brutal";

import { Search } from "lucide-react";
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
      <label className="sn-input focus-within:shadow-hard">
        <Search aria-hidden className="size-5 shrink-0" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter" />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Barbería, uñas, estética"
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

      {ciudades.length > 1 && !cercaDeMi ? (
        <ChipGroup aria-label="Ciudades" className="!pb-0">
          <Chip activo={!ciudad} onClick={() => aplicar({ ciudad: null })}>
            Todas las ciudades
          </Chip>
          {ciudades.map((c) => (
            <Chip key={c} activo={ciudad === c} onClick={() => aplicar({ ciudad: c })}>
              {c}
            </Chip>
          ))}
        </ChipGroup>
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
