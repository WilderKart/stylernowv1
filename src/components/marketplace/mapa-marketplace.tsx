"use client";

import { formatCOP } from "@/lib/utils";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { NegocioTarjeta } from "./negocio-card";

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

export function MapaMarketplace({
  negocios,
  centroInicial,
}: {
  negocios: NegocioTarjeta[];
  centroInicial: { lat: number; lng: number } | null;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    const conUbicacion = negocios.filter(
      (n): n is NegocioTarjeta & { sede_latitud: number; sede_longitud: number } =>
        typeof n.sede_latitud === "number" && typeof n.sede_longitud === "number"
    );

    const centro = centroInicial ?? (conUbicacion[0] ? { lat: conUbicacion[0].sede_latitud, lng: conUbicacion[0].sede_longitud } : { lat: 4.711, lng: -74.0721 });

    const mapa = new MapLibreMap({
      container: contenedorRef.current,
      style: ESTILO_OSM,
      center: [centro.lng, centro.lat],
      zoom: conUbicacion.length > 0 ? 12 : 5,
      attributionControl: false,
    });
    mapa.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapa.addControl(new AttributionControl({ compact: true }));
    mapaRef.current = mapa;

    if (centroInicial) {
      new Marker({ color: "#e8a23c" }).setLngLat([centroInicial.lng, centroInicial.lat]).addTo(mapa);
    }

    const limites = new LngLatBounds();
    if (centroInicial) limites.extend([centroInicial.lng, centroInicial.lat]);

    for (const n of conUbicacion) {
      const popup = new Popup({ offset: 24, closeButton: false }).setHTML(
        `<a href="/negocio/${n.slug}" style="display:block;min-width:160px;text-decoration:none;color:#0a0a0a">
           <strong style="font-size:13px">${escapeHtml(n.nombre)}</strong><br/>
           <span style="font-size:12px">${n.calificacion.toFixed(1)}★ (${n.total_resenas})${n.precio_desde !== null ? " · desde " + formatCOP(n.precio_desde) : ""}</span>
         </a>`
      );
      new Marker({ color: "#1b1815" }).setLngLat([n.sede_longitud, n.sede_latitud]).setPopup(popup).addTo(mapa);
      limites.extend([n.sede_longitud, n.sede_latitud]);
    }

    if (!limites.isEmpty() && conUbicacion.length > 1) {
      mapa.fitBounds(limites, { padding: 60, maxZoom: 14 });
    }

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se inicializa una sola vez; los negocios llegan ya resueltos por props en el primer render
  }, []);

  const sinUbicacion = negocios.length > 0 && negocios.every((n) => n.sede_latitud == null || n.sede_longitud == null);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-border-subtle">
      <div ref={contenedorRef} className="size-full" />
      {sinUbicacion ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/80 px-6 text-center">
          <p className="text-[12.5px] text-text-faint">Ninguno de estos negocios registró su ubicación todavía.</p>
        </div>
      ) : null}
    </div>
  );
}

function escapeHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
