"use client";

import { Photo, Status } from "@/components/brutal";
import { formatCOP } from "@/lib/utils";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fotoNegocio } from "./foto-respaldo";
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
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const seleccionado = negocios.find((n) => n.id === seleccionadoId) ?? null;

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
      new Marker({ element: crearPinYo() }).setLngLat([centroInicial.lng, centroInicial.lat]).addTo(mapa);
    }

    const limites = new LngLatBounds();
    if (centroInicial) limites.extend([centroInicial.lng, centroInicial.lat]);

    for (const n of conUbicacion) {
      const pin = crearPin(n, () => setSeleccionadoId(n.id));
      new Marker({ element: pin, anchor: "bottom-left", offset: [-11, 0] }).setLngLat([n.sede_longitud, n.sede_latitud]).addTo(mapa);
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
    <div className="flex w-full flex-col">
      <div className="sn-map relative !h-[60dvh] !min-h-[320px] w-full">
        <div ref={contenedorRef} className="size-full" />
        {sinUbicacion ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/90 px-6 text-center">
            <p className="sn-label">Ninguno de estos negocios registró su ubicación todavía.</p>
          </div>
        ) : null}
      </div>
      {seleccionado ? (
        <Link
          href={seleccionado.patrocinado && seleccionado.campana_id ? `/negocio/${seleccionado.slug}?campana_id=${seleccionado.campana_id}` : `/negocio/${seleccionado.slug}`}
          className="grid min-h-[110px] grid-cols-[110px_minmax(0,1fr)] border-2 border-t-0 border-border text-text no-underline"
        >
          <Photo src={fotoNegocio(seleccionado.id, seleccionado.logo_url)} className="border-r-2 border-border" />
          <div className="flex min-w-0 flex-col gap-1.5 p-3">
            <span className="sn-meta truncate">{seleccionado.ciudad}</span>
            <span className="poster-4 break-words">{seleccionado.nombre}</span>
            <span className="sn-price">
              {seleccionado.total_resenas > 0 ? `★ ${seleccionado.calificacion.toFixed(1).replace(".", ",")}` : "NUEVO"}
              {seleccionado.precio_desde !== null ? ` · Desde ${formatCOP(seleccionado.precio_desde)}` : ""} ↗
            </span>
          </div>
        </Link>
      ) : (
        <div className="border-2 border-t-0 border-border p-3">
          <Status tone="info">Tocá un pin para ver el negocio</Status>
        </div>
      )}
    </div>
  );
}

/** Pin cuadrado del sistema (.sn-pin) como elemento DOM del Marker de MapLibre. */
function crearPin(n: NegocioTarjeta, alSeleccionar: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", n.nombre);
  el.style.cssText = "background:none;border:0;padding:0;cursor:pointer";
  const etiqueta = n.total_resenas > 0 ? "★ " + n.calificacion.toFixed(1).replace(".", ",") : "NUEVO";
  el.innerHTML = `<span class="sn-pin ${n.patrocinado ? "sn-pin--signal" : ""}" style="position:relative;transform:none;animation:none"><span class="sn-pin__head">${escapeHtml(etiqueta)}</span><span class="sn-pin__stem"></span></span>`;
  el.addEventListener("click", alSeleccionar);
  return el;
}

function crearPinYo() {
  const el = document.createElement("span");
  el.className = "sn-pin sn-pin--me";
  el.style.cssText = "position:relative;transform:none;display:block";
  return el;
}

function escapeHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
