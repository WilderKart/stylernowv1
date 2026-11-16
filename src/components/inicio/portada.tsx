import { obtenerT } from "@/lib/i18n/servidor";
import { ArrowUpRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import s from "./portada.module.css";

/**
 * Portada del Home (maqueta del 2026-11-15): titular, barbero con rayas naranjas, buscador y los
 * tres accesos de categoría. Las rayas, los recuadros inclinados y el trazo se dibujan con código.
 * El buscador y los mosaicos solo llevan a `/?q=` y `/?categoria=`: ahí siguen los filtros de siempre.
 */
const CATEGORIAS = [
  { valor: "barberia", etiqueta: "home.cat_barberia", icono: IconoTijeras },
  { valor: "salon", etiqueta: "home.cat_salon", sub: "home.cat_salon_sub", icono: IconoLoto },
  { valor: "tatuajes", etiqueta: "home.cat_tattoo", icono: IconoTatuaje },
] as const;

export async function Portada() {
  const t = await obtenerT();
  return (
    <section className={s.portada} aria-labelledby="portada-titulo">
      <div className={s.heroe}>
        <div className={s.arte} aria-hidden>
          {/* Rayas naranjas: quedan detrás de la persona porque la foto tiene el fondo recortado. */}
          <svg className={s.rayas} viewBox="0 0 300 252" preserveAspectRatio="none">
            <polygon points="78,9 110,9 70,92 38,92" />
            <polygon points="60,153 93,153 56,222 23,222" />
            <polygon points="230,-4 300,-4 300,30 236,112 176,112" />
          </svg>
          <Image
            className={s.foto}
            src="/img/inicio/barbero.webp"
            alt=""
            width={1199}
            height={1312}
            priority
            sizes="(max-width: 600px) 66vw, 380px"
          />
        </div>

        <h1 id="portada-titulo" className={s.titulo}>
          <span>{t("home.titulo_1")}</span>
          <span>{t("home.titulo_2")}</span>
          <span className={s.caliente}>{t("home.titulo_3")}</span>
        </h1>
        <p className={s.bajada}>
          <span>{t("home.bajada_1")}</span> <span>{t("home.bajada_2")}</span>
        </p>
        <svg className={s.trazo} viewBox="0 0 114 13" aria-hidden>
          <path d="M0.4 11.6C24 4.6 62 0.9 113.2 0.3c0.7 0.5 0.6 1.7-0.3 2.2C71 4.6 33 8.4 2.4 12.8c-1.2 0.2-2.4-0.3-2-1.2z" />
        </svg>
      </div>

      <form action="/" method="get" role="search" className={s.buscador}>
        <Search className={s.lupa} aria-hidden />
        <input
          className={s.campo}
          type="search"
          name="q"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={t("home.buscar")}
          aria-label={t("home.buscar")}
        />
        <button type="submit" className={s.ir} aria-label={t("home.buscar_ir")}>
          <ArrowUpRight aria-hidden />
        </button>
      </form>

      <nav aria-label={t("home.categorias")} className={s.categorias}>
        {CATEGORIAS.map((c, i) => {
          const Icono = c.icono;
          return (
            <Link key={c.valor} href={`/?categoria=${c.valor}`} className={i === 0 ? `${s.mosaico} ${s.destacado}` : s.mosaico}>
              <Icono className={s.icono} />
              <span className={s.etiqueta}>{t(c.etiqueta)}</span>
              {"sub" in c ? <span className={s.subetiqueta}>{t(c.sub)}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className={s.franja}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M14.5 1 4 13.6h6.6L8.4 23 19.6 9.6h-6.7z" />
        </svg>
        <span>{t("home.explora")}</span>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="m12 0 1.9 7.4L19.8 2.6 16.1 9.3 24 10.2l-7.1 3.3 5.7 5.6-7.3-2.6.6 7.6L12 17.6 8.1 24l.6-7.6-7.3 2.6 5.7-5.6L0 10.2l7.9-.9L4.2 2.6l5.9 4.8z"
          />
        </svg>
      </div>
    </section>
  );
}

type PropsIcono = { className?: string };
const TRAZO = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function IconoTijeras({ className }: PropsIcono) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden {...TRAZO}>
      <circle cx="24.6" cy="8.6" r="3.6" />
      <circle cx="21.6" cy="24.4" r="3.6" />
      <path d="M22 11.2 4 27.6" />
      <path d="M19.2 21.8 3.4 7.2M19.2 21.8 9.4 3.2" />
    </svg>
  );
}

function IconoLoto({ className }: PropsIcono) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden {...TRAZO}>
      <path d="M16 4.6c-4.6 4.4-6 12.4 0 19.6 6-7.2 4.6-15.2 0-19.6z" />
      <path d="M12 10.2c-2.2-1-4.4-1.2-6.2-.8-.6 4.4.6 9.4 6 12.4M20 10.2c2.2-1 4.4-1.2 6.2-.8.6 4.4-.6 9.4-6 12.4" />
      <path d="M16 24.2c-4.6 2.2-10.4 1-14-4.4 3.4-2 7-1.8 10 .2M16 24.2c4.6 2.2 10.4 1 14-4.4-3.4-2-7-1.8-10 .2" />
    </svg>
  );
}

function IconoTatuaje({ className }: PropsIcono) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden {...TRAZO}>
      <g transform="rotate(-42 16 16)">
        <path d="M1.4 16h3.4" />
        <rect x="4.8" y="13.6" width="10.4" height="4.8" rx="1" />
        <path d="M15.2 15h2.6v2h-2.6" />
        <rect x="17.8" y="10.4" width="9.6" height="11.2" rx="1.6" />
        <path d="M20 10.4V8h3v2.4M27.4 13.4h2.2v5.2h-2.2" />
        <circle cx="21.4" cy="7.2" r="0.6" />
      </g>
    </svg>
  );
}
