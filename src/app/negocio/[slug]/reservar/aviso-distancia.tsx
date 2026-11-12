"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/proveedor";

/** Más allá de esta distancia (km) se avisa; dentro de un área metropolitana no estorba. */
const UMBRAL_KM = 50;

function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Aviso (NO bloqueo) cuando la persona está lejos del negocio que va a reservar: puede estar en Cali hoy y
 * viajar a Bogotá mañana, pero conviene confirmarlo para evitar errores. Solo usa la ubicación si el navegador
 * ya tiene el permiso concedido (nunca lo pide por sorpresa) y la ubicación no sale del dispositivo.
 */
export function AvisoDistancia({
  negocio,
  sede,
}: {
  negocio: string;
  sede: { latitud?: number | null; longitud?: number | null; ciudad?: string | null; nombre: string } | undefined;
}) {
  const t = useT();
  const [km, setKm] = useState<number | null>(null);
  const [yoLat, setYoLat] = useState<number | null>(null);
  const [yoLng, setYoLng] = useState<number | null>(null);
  const [cerrado, setCerrado] = useState(false);

  const lat = sede?.latitud ?? null;
  const lng = sede?.longitud ?? null;

  useEffect(() => {
    if (lat === null || lng === null || !("geolocation" in navigator) || !navigator.permissions) return;
    let vivo = true;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((estado) => {
        if (estado.state !== "granted" || !vivo) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!vivo) return;
            setYoLat(pos.coords.latitude);
            setYoLng(pos.coords.longitude);
            setKm(distanciaKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { lat, lng }));
          },
          () => {},
          { timeout: 5000, maximumAge: 600_000, enableHighAccuracy: false },
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [lat, lng]);

  if (cerrado || km === null || km <= UMBRAL_KM) return null;

  const lugar = sede?.ciudad ? `${negocio} (${sede.ciudad})` : negocio;
  return (
    <div role="alert" className="flex flex-col gap-2 border-b-2 border-ink bg-warning px-4 py-3 text-ink">
      <p className="sn-label flex items-center gap-2">
        <MapPin aria-hidden className="size-4 shrink-0" /> {t("res.aviso_km", { km: Math.round(km) })}
      </p>
      <p className="body-sm break-words">
        {t("res.aviso_txt", { lugar })}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCerrado(true)} className="sn-chip is-selected !min-h-12">
          {t("res.si_mi_plan")}
        </button>
        {yoLat !== null && yoLng !== null ? (
          <Link href={`/?lat=${yoLat.toFixed(4)}&lng=${yoLng.toFixed(4)}`} className="sn-chip !min-h-12 no-underline">
            {t("res.ver_cerca")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
