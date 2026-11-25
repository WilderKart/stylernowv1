import { obtenerT } from "@/lib/i18n/servidor";
import { CalendarCheck, Flower2, MapPin, Paintbrush, Scissors, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import s from "./portada.module.css";

/**
 * Portada del Home (referencia de diseño unificada): titular, buscador con ciudad, accesos por categoría y foto
 * destacada a la derecha en pantallas anchas. El buscador y los accesos solo llevan a `/?q=&ciudad=` y
 * `/?categoria=`: ahí siguen los filtros de siempre. Una sola portada para todos los tipos de negocio.
 */
const CATEGORIAS = [
  { href: "/?categoria=barberia", titulo: "home.cat_barberia", sub: "home.cat_barberia_sub", icono: Scissors },
  { href: "/?categoria=salon", titulo: "home.cat_salon_largo", sub: "home.cat_salon_sub2", icono: Flower2 },
  { href: "/?categoria=tatuajes", titulo: "home.cat_tattoo_cap", sub: "home.cat_tattoo_sub", icono: Paintbrush },
] as const;

export async function Portada() {
  const t = await obtenerT();
  return (
    <section className={s.portada} aria-labelledby="portada-titulo">
      <div className={s.texto}>
        <h1 id="portada-titulo" className={s.titulo}>
          <span>{t("home.titulo_1")}</span>
          <span>{t("home.titulo_2")}</span>
          <span>{t("home.titulo_3")}</span>
        </h1>
        <p className={s.bajada}>{t("home.bajada_larga")}</p>

        <form action="/" method="get" role="search" className={s.buscador}>
          <label className={s.campoQ}>
            <Search className={s.icono} aria-hidden />
            <input type="search" name="q" enterKeyHint="search" autoComplete="off" placeholder={t("home.buscar_neg")} aria-label={t("home.buscar_neg")} />
          </label>
          <label className={s.campoCiudad}>
            <MapPin className={s.icono} aria-hidden />
            <input type="text" name="ciudad" autoComplete="address-level2" placeholder={t("home.ciudad")} aria-label={t("home.ciudad")} />
          </label>
          <button type="submit" className={s.ir}>
            {t("home.buscar_ir")}
          </button>
        </form>

        <nav aria-label={t("home.categorias")} className={s.categorias}>
          {CATEGORIAS.map((c) => {
            const Icono = c.icono;
            return (
              <Link key={c.href} href={c.href} className={s.mosaico}>
                <Icono className={s.iconoCat} aria-hidden />
                <span className={s.mosaicoTexto}>
                  <strong>{t(c.titulo)}</strong>
                  <small>{t(c.sub)}</small>
                </span>
              </Link>
            );
          })}
          <Link href="/?hoy=1" className={`${s.mosaico} ${s.hoy}`}>
            <CalendarCheck className={s.iconoCat} aria-hidden />
            <span className={s.mosaicoTexto}>
              <strong>{t("home.reserva_hoy")}</strong>
              <small>{t("home.reserva_hoy_sub")}</small>
            </span>
          </Link>
        </nav>
      </div>

      <div className={s.arte} aria-hidden>
        <span className={s.mancha} />
        <Image className={s.foto} src="/img/inicio/barbero.webp" alt="" width={1199} height={1312} priority sizes="(max-width: 1024px) 0px, 40vw" />
      </div>
    </section>
  );
}
