"use client";

import dynamic from "next/dynamic";
import type { NegocioTarjeta } from "./negocio-card";

// MapLibre usa WebGL/canvas — nunca puede renderizar en el servidor. El
// dynamic import con `ssr:false` solo se permite dentro de un límite de
// Cliente, por eso este wrapper existe separado del componente real.
const MapaMarketplace = dynamic(() => import("./mapa-marketplace").then((m) => m.MapaMarketplace), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-2xl border border-border-subtle bg-surface" />,
});

export function MapaMarketplaceLazy({
  negocios,
  centroInicial,
}: {
  negocios: NegocioTarjeta[];
  centroInicial: { lat: number; lng: number } | null;
}) {
  return <MapaMarketplace negocios={negocios} centroInicial={centroInicial} />;
}
