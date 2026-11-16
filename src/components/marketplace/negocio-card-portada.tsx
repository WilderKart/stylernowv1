import { TZ_POR_DEFECTO } from "@/lib/formato";
import { obtenerT } from "@/lib/i18n/servidor";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { fotoNegocio } from "./foto-respaldo";
import type { NegocioTarjeta } from "./negocio-card";
import s from "./negocio-card-portada.module.css";

const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ_POR_DEFECTO });

/**
 * Tarjeta de negocio del Home (maqueta 2026-11-15). Mismos datos y destino que NegocioCard;
 * «Disponible hoy» solo aparece si el próximo turno libre real es hoy (hora de Colombia).
 */
export async function NegocioCardPortada({ negocio }: { negocio: NegocioTarjeta }) {
  const t = await obtenerT();
  const href =
    negocio.patrocinado && negocio.campana_id
      ? `/negocio/${negocio.slug}?campana_id=${negocio.campana_id}`
      : `/negocio/${negocio.slug}`;
  const hoy = negocio.proxima_disponibilidad ? dia(new Date(negocio.proxima_disponibilidad)) === dia(new Date()) : false;

  return (
    <Link href={href} className={s.tarjeta}>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto del negocio en Storage o respaldo local (igual que NegocioCard) */}
      <img src={fotoNegocio(negocio.id, negocio.logo_url)} alt="" className={s.foto} loading="lazy" />
      {negocio.patrocinado ? <span className={s.patrocinado}>{t("card.patrocinado")}</span> : null}
      {negocio.ciudad ? <span className={s.ciudad}>{negocio.ciudad}</span> : null}
      <div className={s.panel}>
        <h3 className={s.nombre}>{negocio.nombre}</h3>
        {hoy ? <span className={s.disponible}>{t("card.disponible_hoy")}</span> : null}
        <div className={s.pie}>
          <span>
            <span className={s.estrella} aria-hidden>
              ★
            </span>
            {negocio.total_resenas > 0
              ? `${negocio.calificacion.toFixed(1)} ${t("card.resenas", { n: negocio.total_resenas })}`
              : t("card.nuevo_min")}
          </span>
          <span className={s.precio}>
            {negocio.precio_desde !== null ? `${t("card.desde", { precio: formatCOP(negocio.precio_desde) })} ↗` : "↗"}
          </span>
        </div>
      </div>
    </Link>
  );
}
