import "server-only";
import { llamarRpc, type Resultado } from "./base";

/** C10 Ofertas cerca y beneficios de marcas aliadas. */
export interface OfertaCercana {
  oferta_id: string;
  negocio_id: string;
  negocio_nombre: string;
  slug: string;
  sede_id: string;
  titulo: string;
  descripcion: string | null;
  /** PORCENTAJE → «−valor %», DOS_POR_UNO → «2×1», MONTO → «−valor». */
  tipo_descuento: "PORCENTAJE" | "DOS_POR_UNO" | "MONTO";
  valor: number | null;
  /** 0=domingo … 6=sábado; null = todos los días. */
  dias_semana: number[] | null;
  vigente_hasta: string | null;
  /** null si no se enviaron coordenadas. */
  distancia_km: number | null;
}

/** Ofertas vigentes de negocios activos dentro de `radioKm` (por defecto 2 km). Requiere sesión. */
export function ofertasCercanas(opts: { lat?: number; lng?: number; radioKm?: number; limite?: number } = {}): Promise<Resultado<OfertaCercana[]>> {
  return llamarRpc<OfertaCercana[]>("ofertas_cercanas", {
    ...(opts.lat != null && opts.lng != null ? { p_lat: opts.lat, p_lng: opts.lng } : {}),
    p_radio_km: opts.radioKm ?? 2,
    p_limite: opts.limite ?? 20,
  });
}

export interface BeneficiosMarcas {
  /** Consentimiento vigente «beneficios_marcas». */
  activo: boolean;
  /** Cantidad total disponible (para «ACTIVA LA CASILLA PARA VER N BENEFICIOS»). */
  total: number;
  /** Vacío mientras `activo` sea false. */
  items: { beneficio_id: string; marca: string; titulo: string; descripcion: string | null; vigente_hasta: string | null }[];
}
export const obtenerBeneficiosMarcas = (): Promise<Resultado<BeneficiosMarcas>> => llamarRpc<BeneficiosMarcas>("beneficios_marcas");

/** Casilla «Quiero recibir beneficios de marcas aliadas». Registra el evento de consentimiento (nunca premarcada). */
export const consentirBeneficiosMarcas = (otorgado: boolean): Promise<Resultado<BeneficiosMarcas>> =>
  llamarRpc<BeneficiosMarcas>("beneficios_marcas_consentir", { p_otorgado: otorgado });
