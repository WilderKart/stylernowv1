import { Num, Photo, Status } from "@/components/brutal";
import { proximaDisponibilidad } from "@/lib/formato";
import { cn, formatCOP } from "@/lib/utils";
import Link from "next/link";
import { fotoNegocio } from "./foto-respaldo";

export interface NegocioTarjeta {
  id: string;
  nombre: string;
  slug: string;
  ciudad: string;
  categoria: string[];
  logo_url: string | null;
  calificacion: number;
  total_resenas: number;
  precio_desde: number | null;
  proxima_disponibilidad: string | null;
  patrocinado?: boolean;
  campana_id?: string | null;
  sede_latitud?: number | null;
  sede_longitud?: number | null;
}

/**
 * Tarjeta de resultado del Marketplace (patrón .sn-shop del prototipo). Un perfil sin
 * foto usa una imagen de respaldo del sistema, nunca un espacio roto
 * (02-UX/04_Marketplace.md, caso límite). `patrocinado` = tarjeta destacada en naranja.
 */
export function NegocioCard({
  negocio,
  index,
  className,
}: {
  negocio: NegocioTarjeta;
  index?: number;
  className?: string;
}) {
  const disponibilidad = proximaDisponibilidad(negocio.proxima_disponibilidad);

  const href =
    negocio.patrocinado && negocio.campana_id
      ? `/negocio/${negocio.slug}?campana_id=${negocio.campana_id}`
      : `/negocio/${negocio.slug}`;

  return (
    <Link
      href={href}
      className={cn("sn-shop relative min-w-0 text-text no-underline", negocio.patrocinado && "is-featured", className)}
    >
      {negocio.patrocinado ? <span className="p-spons">Patrocinado</span> : null}
      <Photo src={fotoNegocio(negocio.id, negocio.logo_url)} className="!h-[110px]" />
      <div className="sn-shop__body">
        {index != null ? <Num>{String(index).padStart(2, "0")} /</Num> : <span />}
        <span className="sn-meta truncate">{negocio.ciudad}</span>
        <h3 className="sn-shop__name poster-4 break-words">{negocio.nombre}</h3>
        {negocio.categoria.length > 0 ? (
          <span className="sn-meta col-span-full break-words">{negocio.categoria.slice(0, 2).join(" · ")}</span>
        ) : null}
        {disponibilidad ? (
          <div className="col-span-full">
            <Status tone="ok">{disponibilidad}</Status>
          </div>
        ) : null}
        <div className="sn-shop__foot gap-2">
          <span className="sn-price">
            {negocio.total_resenas > 0 ? `★ ${negocio.calificacion.toFixed(1).replace(".", ",")}` : "NUEVO"}
          </span>
          {negocio.precio_desde !== null ? (
            <span className="sn-price text-right">Desde {formatCOP(negocio.precio_desde)} ↗</span>
          ) : (
            <span className="sn-price">↗</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Esqueleto de carga con la misma forma que NegocioCard. */
export function NegocioCardSkeleton() {
  return (
    <div className="sn-shop animate-pulse" aria-hidden>
      <div className="sn-photo !h-[110px]" />
      <div className="sn-shop__body">
        <span className="h-3 w-10 bg-surface-2" />
        <span className="h-3 w-16 bg-surface-2" />
        <span className="col-span-full h-7 w-3/4 bg-surface-2" />
        <div className="sn-shop__foot">
          <span className="h-4 w-12 bg-surface-2" />
          <span className="h-4 w-24 bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
