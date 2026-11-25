import e from "@/app/inicio.module.css";
import { obtenerT } from "@/lib/i18n/servidor";
import { CalendarCheck, CalendarDays, ChevronRight, Gift, ScanSearch, ShieldCheck, Star, Store, Scissors } from "lucide-react";
import Link from "next/link";
import b from "./bloques.module.css";

/**
 * Bloques de la portada bajo «Explora negocios cerca de ti» (referencia de diseño): cómo funciona, lo que gana quien reserva,
 * Rewards y captación de negocios. Nunca muestra negocios inventados ni cifras. `completo` = sin negocios que mostrar
 * (incluye el aviso «Muy pronto cerca de ti»); `resto` = los bloques informativos tras el listado real.
 */
export async function BloquesLanzamiento({ variante, conSesion }: { variante: "completo" | "resto"; conSesion: boolean }) {
  const t = await obtenerT();

  const pasos = [
    { icono: ScanSearch, titulo: t("lanz.paso1_t"), texto: t("lanz.paso1_d") },
    { icono: CalendarCheck, titulo: t("lanz.paso2_t"), texto: t("lanz.paso2_d") },
    { icono: Scissors, titulo: t("lanz.paso3_t"), texto: t("lanz.paso3_d") },
  ];
  const beneficios = [
    { icono: CalendarDays, titulo: t("lanz.b1_t"), texto: t("lanz.b1_d") },
    { icono: ShieldCheck, titulo: t("lanz.b2_t"), texto: t("lanz.b2_d") },
    { icono: Star, titulo: t("lanz.b3_t"), texto: t("lanz.b3_d") },
    { icono: Gift, titulo: t("lanz.b4_t"), texto: t("lanz.b4_d") },
  ];
  const categorias = [t("home.cat_barberia"), t("home.cat_salon"), t("home.cat_tattoo"), t("home.cat_spa")];

  return (
    <div className={b.raiz}>
      {variante === "completo" ? (
        <section aria-labelledby="lanz-pronto" className={b.pronto}>
          <h2 id="lanz-pronto" className={b.tituloPronto}>
            {t("lanz.pronto_titulo")}
          </h2>
          <ul className={b.etiquetas} aria-label={t("home.categorias")}>
            {categorias.map((c) => (
              <li key={c} className={b.etiqueta}>
                <span>{c}</span>
                <em>{t("lanz.pronto_tag")}</em>
              </li>
            ))}
          </ul>
          <p className={b.textoPronto}>{conSesion ? t("lanz.pronto_desc_sesion") : t("lanz.pronto_desc")}</p>
          {!conSesion ? (
            <Link href="/registro" className={b.boton}>
              {t("lanz.cta_cuenta")}
            </Link>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="lanz-como" className={b.seccion}>
        <h2 id="lanz-como" className={e.titulo}>
          {t("lanz.como_titulo")}
        </h2>
        <ol className={b.pasos}>
          {pasos.map((p, i) => {
            const Icono = p.icono;
            return (
              <li key={p.titulo} className={b.paso}>
                <span className={b.circulo} aria-hidden>
                  <Icono />
                </span>
                <div>
                  <p className={b.pasoTitulo}>
                    {i + 1}. {p.titulo}
                  </p>
                  <p className={b.pasoTexto}>{p.texto}</p>
                </div>
                {i < pasos.length - 1 ? <ChevronRight className={b.flecha} aria-hidden /> : null}
              </li>
            );
          })}
        </ol>
      </section>

      <ul className={b.beneficios} aria-label={t("lanz.gana_titulo")}>
        {beneficios.map((x) => {
          const Icono = x.icono;
          return (
            <li key={x.titulo} className={b.beneficio}>
              <span className={b.icono} aria-hidden>
                <Icono />
              </span>
              <div>
                <p className={b.pasoTitulo}>{x.titulo}</p>
                <p className={b.pasoTexto}>{x.texto}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={b.banners}>
        <section className={b.banner} aria-labelledby="lanz-rewards">
          <span className={b.iconoGrande} aria-hidden>
            <Star />
          </span>
          <div className={b.bannerTexto}>
            <h2 id="lanz-rewards">{t("lanz.rewards_t")}</h2>
            <p>{t("lanz.rewards_d")}</p>
          </div>
          <Link href="/lealtad" className={b.botonClaro}>
            {t("lanz.rewards_cta")}
          </Link>
        </section>
        <section className={b.banner} aria-labelledby="lanz-negocios">
          <span className={b.iconoGrande} aria-hidden>
            <Store />
          </span>
          <div className={b.bannerTexto}>
            <h2 id="lanz-negocios">{t("lanz.neg_titulo")}</h2>
            <p>{t("lanz.neg_desc")}</p>
          </div>
          <Link href="/para-negocios" className={b.boton}>
            {t("lanz.neg_cta")} →
          </Link>
        </section>
      </div>
    </div>
  );
}
