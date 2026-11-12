"use client";

import dynamic from "next/dynamic";
import { useT } from "@/lib/i18n/proveedor";
import type { NegocioTarjeta } from "./negocio-card";

function CargandoMapa() {
  const t = useT();
  return <div className="sn-map !h-[60dvh] !min-h-[320px] animate-pulse" aria-busy="true" aria-label={t("mapa.cargando")} />;
}

// MapLibre usa WebGL/canvas — nunca puede renderizar en el servidor. El
// dynamic import con `ssr:false` solo se permite dentro de un límite de
// Cliente, por eso este wrapper existe separado del componente real.
const MapaMarketplace = dynamic(() => import("./mapa-marketplace").then((m) => m.MapaMarketplace), {
  ssr: false,
  loading: () => <CargandoMapa />,
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
