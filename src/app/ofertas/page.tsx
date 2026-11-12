import { Pantalla, Top, ErrorAviso } from "@/app/lealtad/ui-cliente";
import { EmptyState } from "@/components/brutal";
import { obtenerBeneficiosMarcas, ofertasCercanas, type OfertaCercana } from "@/lib/cliente/ofertas";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CasillaMarcas } from "./casilla-marcas";
import { UsarUbicacion } from "./usar-ubicacion";
import { obtenerIdioma, obtenerT } from "@/lib/i18n/servidor";
import type { Traductor } from "@/lib/i18n/diccionario";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("of.meta"), robots: { index: false, follow: false } };
}

const RADIO_KM = 2;
const DIAS = ["of.dia_0", "of.dia_1", "of.dia_2", "of.dia_3", "of.dia_4", "of.dia_5", "of.dia_6"] as const;

function num(v: string | string[] | undefined, min: number, max: number) {
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function descuento(o: OfertaCercana, t: Traductor) {
  if (o.tipo_descuento === "DOS_POR_UNO") return "2×1";
  if (o.valor == null) return t("of.oferta");
  return o.tipo_descuento === "PORCENTAJE" ? `−${o.valor} %` : `−$ ${new Intl.NumberFormat("es-CO").format(o.valor)}`;
}

const FONDOS = ["var(--signal)", "var(--warning)", "var(--success)"];

function meta(o: OfertaCercana, t: Traductor, loc: string) {
  const partes = [o.negocio_nombre];
  if (o.distancia_km != null) partes.push(o.distancia_km < 1 ? `${Math.round(o.distancia_km * 1000)} m` : `${o.distancia_km.toFixed(1).replace(".", ",")} km`);
  if (o.dias_semana?.length) partes.push(o.dias_semana.map((d) => t(DIAS[d])).join(", "));
  partes.push(
    o.vigente_hasta
      ? t("of.hasta", { fecha: new Intl.DateTimeFormat(loc, { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(new Date(o.vigente_hasta)).replace(".", "") })
      : t("of.sin_fecha")
  );
  return partes.join(" · ");
}

export default async function OfertasPage(props: PageProps<"/ofertas">) {
  const t = await obtenerT();
  const loc = (await obtenerIdioma()) === "en" ? "en-US" : "es-CO";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ofertas");

  const sp = await props.searchParams;
  const lat = num(sp.lat, -90, 90);
  const lng = num(sp.lng, -180, 180);
  const conUbicacion = lat != null && lng != null;

  const [ofertas, marcas] = await Promise.all([
    ofertasCercanas(conUbicacion ? { lat, lng, radioKm: RADIO_KM } : { radioKm: RADIO_KM }),
    obtenerBeneficiosMarcas(),
  ]);

  return (
    <Pantalla className="pb-10">
      <Top titulo={t("of.top")} volverA="/" />

      <h1 className="poster-2 break-words p-4">
        {t("of.t1")} <span className="sn-hot">{t("of.t2")}</span>
      </h1>

      <div className="p-sec">
        <h2 className="sn-num">{t("of.sec_negocios")}</h2>
        <span className="sn-label">{conUbicacion ? t("of.menos_km", { km: RADIO_KM }) : t("of.en_tu_zona")}</span>
      </div>
      {!conUbicacion ? <UsarUbicacion /> : null}

      {!ofertas.ok ? (
        <div className="px-4">
          <ErrorAviso>{ofertas.error}</ErrorAviso>
        </div>
      ) : ofertas.data.length === 0 ? (
        <div className="px-4">
          <EmptyState big={t("of.sin_ofertas")} title={t("of.sin_ofertas_titulo")} hint={t("of.sin_ofertas_hint")} />
        </div>
      ) : (
        <div className="border-t-2 border-border">
          {ofertas.data.map((o, i) => (
            <Link key={o.oferta_id} href={`/negocio/${o.slug}`} className="p-row">
              <span
                className="sn-fig grid min-h-12 w-16 shrink-0 place-items-center border-2 border-ink px-1 text-center text-sm text-ink"
                style={{ background: FONDOS[i % FONDOS.length] }}
              >
                {descuento(o, t)}
              </span>
              <span className="p-row__t">
                <b className="break-words">{o.titulo}</b>
                <span className="sn-meta break-words">{meta(o, t, loc)}</span>
              </span>
              <span className="p-row__r" aria-hidden>
                ↗
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="p-sec mt-4">
        <h2 className="sn-num">{t("of.sec_marcas")}</h2>
        <span className="sn-label">{t("of.opcional")}</span>
      </div>
      {!marcas.ok ? (
        <div className="px-4">
          <ErrorAviso>{marcas.error}</ErrorAviso>
        </div>
      ) : (
        <>
          <CasillaMarcas activoInicial={marcas.data.activo} />
          {marcas.data.activo ? (
            marcas.data.items.length > 0 ? (
              <div className="mt-2 flex flex-col gap-3 px-4">
                {marcas.data.items.map((b) => (
                  <div key={b.beneficio_id} className="border-2 border-line p-3">
                    <div className="sn-meta">{t("of.marca_aliada", { marca: b.marca })}</div>
                    <div className="section mt-1 break-words">{b.titulo}</div>
                    {b.descripcion ? <p className="body-sm mt-1 break-words">{b.descripcion}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="sn-num mt-2 px-4">{t("of.sin_beneficios")}</p>
            )
          ) : (
            <p className="sn-num mt-2 break-words px-4">
              {marcas.data.total === 1 ? t("of.activa_casilla", { n: marcas.data.total }) : t("of.activa_casilla_n", { n: marcas.data.total })}
            </p>
          )}
        </>
      )}
    </Pantalla>
  );
}
