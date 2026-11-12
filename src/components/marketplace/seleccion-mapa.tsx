"use client";

import { Photo } from "@/components/brutal";
import { useT } from "@/lib/i18n/proveedor";
import { formatCOP } from "@/lib/utils";
import { X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { fotoNegocio } from "./foto-respaldo";
import { etiquetaCategoria, IconoCategoria } from "./icono-categoria";
import type { NegocioTarjeta } from "./negocio-card";

/**
 * Estado compartido entre el mapa y la zona de filtros del home: al tocar un pin, los filtros dejan su
 * lugar a la tarjeta del negocio (así nunca queda "por allá abajo" fuera de la pantalla); con la X vuelven.
 */
interface Contexto {
  seleccionado: NegocioTarjeta | null;
  seleccionar: (n: NegocioTarjeta | null) => void;
}

const SeleccionContext = createContext<Contexto>({ seleccionado: null, seleccionar: () => {} });

export function SeleccionMapaProvider({ children }: { children: ReactNode }) {
  const [seleccionado, setSeleccionado] = useState<NegocioTarjeta | null>(null);
  const seleccionar = useCallback((n: NegocioTarjeta | null) => setSeleccionado(n), []);
  const valor = useMemo(() => ({ seleccionado, seleccionar }), [seleccionado, seleccionar]);
  return <SeleccionContext.Provider value={valor}>{children}</SeleccionContext.Provider>;
}

export function useSeleccionMapa() {
  return useContext(SeleccionContext);
}

/**
 * Muestra los filtros o, si hay un negocio seleccionado en el mapa, su tarjeta. Los filtros se ocultan sin
 * desmontarse, así el texto de búsqueda y los chips conservan su estado al cerrar la tarjeta.
 */
export function ZonaFiltros({ children }: { children: ReactNode }) {
  const { seleccionado, seleccionar } = useSeleccionMapa();
  return (
    <>
      <div hidden={seleccionado !== null}>{children}</div>
      {seleccionado ? <TarjetaSeleccion negocio={seleccionado} onCerrar={() => seleccionar(null)} /> : null}
    </>
  );
}

function TarjetaSeleccion({ negocio: n, onCerrar }: { negocio: NegocioTarjeta; onCerrar: () => void }) {
  const t = useT();
  const href = n.patrocinado && n.campana_id ? `/negocio/${n.slug}?campana_id=${n.campana_id}` : `/negocio/${n.slug}`;
  return (
    <section aria-label={t("mapa.seleccionado")} className="mb-6 flex flex-col border-2 border-border bg-bg shadow-hard">
      {/* Pestaña: tipo de negocio + cerrar */}
      <div className="flex items-center justify-between gap-2 border-b-2 border-border bg-ink pl-3 text-paper">
        <span className="sn-label flex min-w-0 items-center gap-2">
          <IconoCategoria categoria={n.categoria} className="size-4 shrink-0" />
          <span className="truncate">{t(etiquetaCategoria(n.categoria))}</span>
        </span>
        <button type="button" onClick={onCerrar} aria-label={t("mapa.cerrar_volver")} className="sn-iconbtn text-paper">
          <X aria-hidden />
        </button>
      </div>
      <Link href={href} className="grid grid-cols-[104px_minmax(0,1fr)] text-text no-underline">
        <Photo src={fotoNegocio(n.id, n.logo_url)} className="min-h-[112px] border-r-2 border-border" />
        <div className="flex min-w-0 flex-col gap-1.5 p-3">
          <span className="poster-5 break-words">{n.nombre}</span>
          <span className="sn-meta truncate">{n.ciudad}</span>
          <span className="sn-price">
            {n.total_resenas > 0 ? `★ ${n.calificacion.toFixed(1).replace(".", ",")}` : t("card.nuevo_min")}
            {n.precio_desde !== null ? t("card.desde_precio", { precio: formatCOP(n.precio_desde) }) : ""}
          </span>
        </div>
      </Link>
      <Link href={href} className="sn-btn sn-btn--primary !border-x-0 !border-b-0 !shadow-none">
        <span>{t("mapa.ver_negocio")}</span>
        <span aria-hidden>↗</span>
      </Link>
    </section>
  );
}
