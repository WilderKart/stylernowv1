"use client";

import { LngLat, Map as MapLibreMap, Marker, NavigationControl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

// Mismo estilo mínimo OpenStreetMap que el mapa del marketplace (sin proveedor de pago ni API key).
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

const CENTRO_POR_DEFECTO = { lat: 4.65, lng: -74.1 }; // Colombia, vista amplia (solo si no hay punto)

/**
 * Vista previa de la ubicación con marcador que el usuario puede arrastrar o colocar con un toque.
 * Solo informa de la posición; la validación real (país, ciudad) la hace el servidor.
 */
export function MapaUbicacion({
  punto,
  onCambio,
}: {
  punto: { lat: number; lng: number } | null;
  onCambio: (p: { lat: number; lng: number }) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapLibreMap | null>(null);
  const marcador = useRef<Marker | null>(null);
  const alCambiar = useRef(onCambio);
  useEffect(() => {
    alCambiar.current = onCambio;
  }, [onCambio]);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const inicio = punto ?? CENTRO_POR_DEFECTO;
    const m = new MapLibreMap({
      container: contenedor.current,
      style: ESTILO_OSM,
      center: [inicio.lng, inicio.lat],
      zoom: punto ? 16 : 5,
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("click", (e) => alCambiar.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
      marcador.current = null;
    };
    // El mapa se crea una sola vez; los cambios de `punto` los maneja el efecto siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!punto) {
      marcador.current?.remove();
      marcador.current = null;
      return;
    }
    if (!marcador.current) {
      const mk = new Marker({ draggable: true, color: "#FF4B00" }).setLngLat([punto.lng, punto.lat]).addTo(m);
      mk.on("dragend", () => {
        const p: LngLat = mk.getLngLat();
        alCambiar.current({ lat: p.lat, lng: p.lng });
      });
      marcador.current = mk;
      m.jumpTo({ center: [punto.lng, punto.lat], zoom: Math.max(m.getZoom(), 16) });
    } else {
      marcador.current.setLngLat([punto.lng, punto.lat]);
      m.easeTo({ center: [punto.lng, punto.lat], duration: 300 });
    }
  }, [punto]);

  return (
    <div
      ref={contenedor}
      role="application"
      aria-label="Mapa para ajustar la ubicación de tu negocio. Arrastra el marcador o toca el mapa."
      className="h-56 w-full border-2 border-border bg-border-subtle sm:h-64"
    />
  );
}
