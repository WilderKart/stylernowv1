"use client";

import { cn } from "@/lib/utils";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconoCategoria } from "./icono-categoria";
import type { NegocioTarjeta } from "./negocio-card";
import { useSeleccionMapa } from "./seleccion-mapa";

// Estilo mínimo con tiles crudos de OpenStreetMap — decisión ya tomada
// (00_MASTER_TASKLIST.md: "MapLibre + OpenStreetMap"). Sin proveedor de
// pago ni API key: suficiente para el volumen actual del proyecto: ver
// docs/PENDING_DECISIONS.md para la nota sobre un proveedor dedicado
// cuando el tráfico real lo justifique (política de uso de OSM).
const ESTILO_OSM: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/** Por debajo de este zoom los pines muestran solo el icono (con varias ciudades a la vista los nombres se pisan). */
const ZOOM_CON_NOMBRE = 11;
const ZOOM_CERCA_DE_MI = 13;

type ConUbicacion = NegocioTarjeta & { sede_latitud: number; sede_longitud: number };
interface Pin {
  n: ConUbicacion;
  el: HTMLElement;
}

export function MapaMarketplace({
  negocios,
  centroInicial,
}: {
  negocios: NegocioTarjeta[];
  centroInicial: { lat: number; lng: number } | null;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapLibreMap | null>(null);
  const marcadoresRef = useRef<Marker[]>([]);
  const yoRef = useRef<Marker | null>(null);
  const { seleccionado, seleccionar } = useSeleccionMapa();
  const [pines, setPines] = useState<Pin[]>([]);
  const [zoom, setZoom] = useState(5);
  const [listo, setListo] = useState(false);

  const latCentro = centroInicial?.lat ?? null;
  const lngCentro = centroInicial?.lng ?? null;

  // 1) El mapa se crea una sola vez.
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;
    const mapa = new MapLibreMap({
      container: contenedorRef.current,
      style: ESTILO_OSM,
      center: [latCentro ?? -74.0721, lngCentro ?? 4.711],
      zoom: latCentro !== null ? ZOOM_CERCA_DE_MI : 5,
      attributionControl: false,
    });
    mapa.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapa.addControl(new AttributionControl({ compact: true }));
    mapa.on("zoomend", () => setZoom(mapa.getZoom()));
    mapa.on("click", () => seleccionar(null)); // tocar el fondo cierra la tarjeta
    mapaRef.current = mapa;
    setListo(true);
    return () => {
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current = [];
      yoRef.current?.remove();
      yoRef.current = null;
      mapa.remove();
      mapaRef.current = null;
      setListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se inicializa una sola vez
  }, []);

  // 2) Los pines se reconstruyen cada vez que cambian los resultados (filtros, búsqueda, "cerca de mí").
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !listo) return;

    marcadoresRef.current.forEach((m) => m.remove());
    marcadoresRef.current = [];

    const conUbicacion = negocios.filter(
      (n): n is ConUbicacion => typeof n.sede_latitud === "number" && typeof n.sede_longitud === "number",
    );
    const nuevos: Pin[] = conUbicacion.map((n) => {
      const el = document.createElement("div");
      el.style.cssText = "position:relative;display:block";
      const marcador = new Marker({ element: el, anchor: "bottom-left", offset: [-11, 0] })
        .setLngLat([n.sede_longitud, n.sede_latitud])
        .addTo(mapa);
      marcadoresRef.current.push(marcador);
      return { n, el };
    });
    setPines(nuevos);

    // Sin ubicación del usuario: se encuadran todos los negocios visibles.
    if (latCentro === null && conUbicacion.length > 1) {
      const limites = new LngLatBounds();
      conUbicacion.forEach((n) => limites.extend([n.sede_longitud, n.sede_latitud]));
      mapa.fitBounds(limites, { padding: 60, maxZoom: 14 });
    } else if (latCentro === null && conUbicacion.length === 1) {
      mapa.easeTo({ center: [conUbicacion[0].sede_longitud, conUbicacion[0].sede_latitud], zoom: 13 });
    }

    // Si el negocio seleccionado ya no está en los resultados, se cierra su tarjeta.
    if (seleccionado && !negocios.some((n) => n.id === seleccionado.id)) seleccionar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `seleccionado`/`seleccionar` no deben reconstruir los pines
  }, [negocios, listo]);

  // 3) "Cerca de mí": el mapa viaja a la ubicación del usuario y la marca.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !listo) return;
    yoRef.current?.remove();
    yoRef.current = null;
    if (latCentro === null || lngCentro === null) return;

    const el = document.createElement("span");
    el.className = "sn-pin sn-pin--me";
    el.style.cssText = "position:relative;transform:none;display:block";
    el.setAttribute("aria-label", "Tu ubicación");
    yoRef.current = new Marker({ element: el }).setLngLat([lngCentro, latCentro]).addTo(mapa);
    mapa.flyTo({ center: [lngCentro, latCentro], zoom: ZOOM_CERCA_DE_MI, essential: true });
  }, [latCentro, lngCentro, listo]);

  // 4) Al seleccionar un pin se centra suavemente en él.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !seleccionado) return;
    const n = seleccionado;
    if (typeof n.sede_latitud === "number" && typeof n.sede_longitud === "number") {
      mapa.easeTo({ center: [n.sede_longitud, n.sede_latitud], duration: 350 });
    }
  }, [seleccionado]);

  const sinUbicacion = negocios.length > 0 && negocios.every((n) => n.sede_latitud == null || n.sede_longitud == null);
  const conNombre = zoom >= ZOOM_CON_NOMBRE;

  return (
    <div className="flex w-full flex-col">
      <div className="sn-map relative !h-[60dvh] !min-h-[320px] w-full">
        <div ref={contenedorRef} className="size-full" />
        {sinUbicacion ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/90 px-6 text-center">
            <p className="sn-label">Ninguno de estos negocios registró su ubicación todavía.</p>
          </div>
        ) : null}
      </div>
      {!seleccionado ? (
        <p className="sn-meta border-2 border-t-0 border-border p-3">Toca un pin para ver el negocio</p>
      ) : null}
      {pines.map(({ n, el }) =>
        createPortal(
          <PinNegocio n={n} activo={seleccionado?.id === n.id} conNombre={conNombre} onClick={() => seleccionar(n)} />,
          el,
          n.id,
        ),
      )}
    </div>
  );
}

/** Pin cuadrado del sistema (.sn-pin): icono del tipo de negocio y, con zoom suficiente, su nombre. */
function PinNegocio({ n, activo, conNombre, onClick }: { n: NegocioTarjeta; activo: boolean; conNombre: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // que el clic no llegue al mapa (cerraría la tarjeta recién abierta)
        onClick();
      }}
      aria-label={n.nombre}
      aria-pressed={activo}
      style={{ background: "none", border: 0, padding: 0, cursor: "pointer", zIndex: activo ? 10 : undefined, position: "relative" }}
    >
      <span
        className={cn("sn-pin", n.patrocinado && "sn-pin--signal", activo && "is-selected")}
        style={{ position: "relative", transform: "none", animation: "none" }}
      >
        <span className="sn-pin__head" style={{ maxWidth: 176, overflow: "hidden" }}>
          <IconoCategoria categoria={n.categoria} className="size-3.5 shrink-0" />
          {conNombre ? <span className="min-w-0 truncate">{n.nombre}</span> : null}
        </span>
        <span className="sn-pin__stem" />
      </span>
    </button>
  );
}
