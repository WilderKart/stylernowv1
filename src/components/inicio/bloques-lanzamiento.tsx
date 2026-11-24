import e from "@/app/inicio.module.css";
import { obtenerT } from "@/lib/i18n/servidor";
import Link from "next/link";

/**
 * Contenido de la portada mientras el catálogo es pequeño (debajo de «Explora negocios cerca de ti»).
 * Nunca muestra negocios inventados ni cifras: explica el servicio, lo que gana el cliente y capta tanto a clientes
 * como a negocios. `completo` = sin negocios que mostrar; `negocios` = solo el bloque para negocios (con pocos resultados).
 */
export async function BloquesLanzamiento({ variante, conSesion }: { variante: "completo" | "negocios"; conSesion: boolean }) {
  const t = await obtenerT();

  const pasos = [
    { n: "1", titulo: t("lanz.paso1_t"), texto: t("lanz.paso1_d") },
    { n: "2", titulo: t("lanz.paso2_t"), texto: t("lanz.paso2_d") },
    { n: "3", titulo: t("lanz.paso3_t"), texto: t("lanz.paso3_d") },
  ];
  const beneficios = [
    { titulo: t("lanz.b1_t"), texto: t("lanz.b1_d") },
    { titulo: t("lanz.b2_t"), texto: t("lanz.b2_d") },
    { titulo: t("lanz.b3_t"), texto: t("lanz.b3_d") },
    { titulo: t("lanz.b4_t"), texto: t("lanz.b4_d") },
  ];
  const categorias = [t("home.cat_barberia"), t("home.cat_salon"), t("home.cat_tattoo"), t("home.cat_spa")];

  const bloqueNegocios = (
    <section aria-labelledby="lanz-negocios" className="mx-4 mt-8 border-2 border-border bg-ink p-5 text-paper shadow-hard sm:mx-6">
      <h2 id="lanz-negocios" className="font-display text-[clamp(22px,6vw,30px)] font-black uppercase leading-none">
        {t("lanz.neg_titulo")}
      </h2>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-paper/80">{t("lanz.neg_desc")}</p>
      <Link
        href="/para-negocios"
        className="mt-4 inline-flex min-h-12 items-center border-2 border-paper bg-signal px-5 font-mono text-[12px] font-bold uppercase tracking-wide text-ink no-underline"
      >
        {t("lanz.neg_cta")} ↗
      </Link>
    </section>
  );

  if (variante === "negocios") return <div className="pb-4">{bloqueNegocios}</div>;

  return (
    <div className="pb-6">
      <section aria-labelledby="lanz-como" className={e.seccion}>
        <h2 id="lanz-como" className={e.titulo}>
          <span className={e.numero}>01 /</span> {t("lanz.como_titulo")}
        </h2>
      </section>
      <ol className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-3 sm:px-6">
        {pasos.map((p) => (
          <li key={p.n} className="flex gap-3 border-2 border-border bg-app p-4 shadow-hard-sm">
            <span className="font-display flex size-9 shrink-0 items-center justify-center border-2 border-border bg-signal text-[18px] font-black text-ink" aria-hidden>
              {p.n}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[16px] font-black uppercase leading-tight text-text">{p.titulo}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="lanz-gana" className={`${e.seccion} mt-4`}>
        <h2 id="lanz-gana" className={e.titulo}>
          <span className={e.numero}>02 /</span> {t("lanz.gana_titulo")}
        </h2>
      </section>
      <ul className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 sm:px-6">
        {beneficios.map((b) => (
          <li key={b.titulo} className="border-2 border-border bg-app p-3.5">
            <p className="font-display text-[14px] font-black uppercase leading-tight text-accent-text">{b.titulo}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">{b.texto}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="lanz-pronto" className={`${e.seccion} mt-4`}>
        <h2 id="lanz-pronto" className={e.titulo}>
          <span className={e.numero}>03 /</span> {t("lanz.pronto_titulo")}
        </h2>
      </section>
      <div className="mx-4 border-2 border-dashed border-border p-4 sm:mx-6">
        <ul className="flex flex-wrap gap-2" aria-label={t("home.categorias")}>
          {categorias.map((c) => (
            <li key={c} className="flex items-center gap-2 border-2 border-border bg-app px-3 py-2">
              <span className="font-mono text-[12px] font-bold uppercase text-text">{c}</span>
              <span className="bg-signal px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">{t("lanz.pronto_tag")}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13.5px] leading-relaxed text-text-muted">{conSesion ? t("lanz.pronto_desc_sesion") : t("lanz.pronto_desc")}</p>
        {!conSesion ? (
          <Link
            href="/registro"
            className="mt-3 inline-flex min-h-12 items-center border-2 border-border bg-signal px-5 font-mono text-[12px] font-bold uppercase tracking-wide text-ink no-underline shadow-hard-sm"
          >
            {t("lanz.cta_cuenta")} ↗
          </Link>
        ) : null}
      </div>

      {bloqueNegocios}
    </div>
  );
}
