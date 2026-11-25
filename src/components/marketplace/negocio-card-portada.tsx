import { TZ_POR_DEFECTO } from "@/lib/formato";
import { obtenerT } from "@/lib/i18n/servidor";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import type { NegocioTarjeta } from "./negocio-card";
import s from "./negocio-card-portada.module.css";

const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ_POR_DEFECTO });
const hora = (d: Date) => d.toLocaleTimeString("es-CO", { timeZone: TZ_POR_DEFECTO, hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Tarjeta de negocio del Home (referencia de diseño). Mismos datos y destino que NegocioCard. El chip de horario
 * solo aparece si el próximo turno libre real es hoy o mañana (hora de Colombia); nunca se inventa disponibilidad.
 */
export async function NegocioCardPortada({ negocio }: { negocio: NegocioTarjeta }) {
  const t = await obtenerT();
  const href =
    negocio.patrocinado && negocio.campana_id
      ? `/negocio/${negocio.slug}?campana_id=${negocio.campana_id}`
      : `/negocio/${negocio.slug}`;

  let chip: string | null = null;
  if (negocio.proxima_disponibilidad) {
    const f = new Date(negocio.proxima_disponibilidad);
    const hoy = new Date();
    const manana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);
    if (dia(f) === dia(hoy)) chip = `${t("home.hoy")} ${hora(f)}`;
    else if (dia(f) === dia(manana)) chip = `${t("home.manana")} ${hora(f)}`;
  }

  return (
    <Link href={href} className={s.tarjeta}>
      <div className={s.portada}>
        {negocio.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del negocio en Storage (URL de dominio propio)
          <img src={negocio.logo_url} alt="" className={s.foto} loading="lazy" />
        ) : (
          <span className={s.inicial} aria-hidden>
            {negocio.nombre.trim().charAt(0).toUpperCase()}
          </span>
        )}
        {negocio.patrocinado ? <span className={s.patrocinado}>{t("card.patrocinado")}</span> : null}
      </div>
      <div className={s.cuerpo}>
        <div className={s.fila}>
          <span className={s.avatar} aria-hidden>
            {negocio.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar del negocio
              <img src={negocio.logo_url} alt="" />
            ) : (
              negocio.nombre.trim().charAt(0).toUpperCase()
            )}
          </span>
          <div className={s.titulos}>
            <h3 className={s.nombre}>{negocio.nombre}</h3>
            <span className={s.meta}>
              <span className={s.estrella} aria-hidden>
                ★
              </span>
              {negocio.total_resenas > 0
                ? `${negocio.calificacion.toFixed(1)} (${t("card.resenas", { n: negocio.total_resenas }).replace(/[()]/g, "")})`
                : t("card.nuevo_min")}
              {negocio.ciudad ? ` · ${negocio.ciudad}` : ""}
            </span>
          </div>
        </div>
        <div className={s.pie}>
          {chip ? <span className={s.chip}>{chip}</span> : <span />}
          {negocio.precio_desde !== null ? <span className={s.precio}>{t("card.desde", { precio: formatCOP(negocio.precio_desde) })}</span> : null}
        </div>
      </div>
    </Link>
  );
}
