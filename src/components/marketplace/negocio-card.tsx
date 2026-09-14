import { Badge } from "@/components/ui/card";
import { Rating } from "@/components/ui/rating";
import { proximaDisponibilidad } from "@/lib/formato";
import { formatCOP } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

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
}

/**
 * Tarjeta de resultado del Marketplace. Un perfil sin foto muestra un placeholder de
 * marca, nunca un espacio roto (02-UX/04_Marketplace.md, caso límite).
 */
export function NegocioCard({ negocio }: { negocio: NegocioTarjeta }) {
  const disponibilidad = proximaDisponibilidad(negocio.proxima_disponibilidad);

  return (
    <Link
      href={`/negocio/${negocio.slug}`}
      className="flex gap-3 rounded-2xl border border-border-subtle bg-surface p-3 transition-colors hover:border-accent/40"
    >
      <div className="relative size-[76px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#3a2e1a] to-[#1a1512]">
        {negocio.logo_url ? (
          <Image
            src={negocio.logo_url}
            alt=""
            fill
            sizes="76px"
            className="object-cover"
          />
        ) : (
          <span className="font-display absolute inset-0 flex items-center justify-center text-xl font-bold text-accent/40">
            {negocio.nombre.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-bold text-text">{negocio.nombre}</p>
        <div className="mt-1 flex items-center gap-2">
          <Rating valor={negocio.calificacion} total={negocio.total_resenas} />
          <span className="truncate text-[11.5px] text-text-faint">{negocio.ciudad}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {negocio.categoria.slice(0, 2).map((c) => (
            <Badge key={c} tone="accent">
              {c}
            </Badge>
          ))}
          {negocio.precio_desde !== null ? (
            <span className="text-[11.5px] text-text-muted">
              desde {formatCOP(negocio.precio_desde)}
            </span>
          ) : null}
        </div>

        {disponibilidad ? (
          <p className="mt-1.5 text-[11.5px] font-semibold text-success">{disponibilidad}</p>
        ) : null}
      </div>
    </Link>
  );
}
