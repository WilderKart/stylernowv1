import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { Filtros } from "@/components/marketplace/filtros";
import { MapaMarketplaceLazy } from "@/components/marketplace/mapa-marketplace-lazy";
import { NegocioCard } from "@/components/marketplace/negocio-card";
import { Sello } from "@/components/marketplace/sello";
import { EmptyState, Marquee, Num } from "@/components/brutal";
import { hoyISO } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Reserva tu cita",
  description:
    "Encuentra barberías, salones y spas cerca de ti y reserva tu turno en segundos.",
};

// Atajos de categoría del Home (los valores son los mismos de Filtros).
const CATEGORIAS_HOME = [
  { valor: "barberia", etiqueta: "Barbería" },
  { valor: "unas", etiqueta: "Uñas" },
  { valor: "estetica", etiqueta: "Estética" },
  { valor: "salon", etiqueta: "Peluquería" },
];

function primerValor(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function HomePage(props: PageProps<"/">) {
  const params = await props.searchParams;
  const supabase = await createClient();

  const texto = primerValor(params.q);
  const ciudad = primerValor(params.ciudad);
  const categoria = primerValor(params.categoria);
  const orden = primerValor(params.orden);
  const soloHoy = primerValor(params.hoy) === "1";
  const lat = primerValor(params.lat);
  const lng = primerValor(params.lng);
  const vista = primerValor(params.vista) === "mapa" ? "mapa" : "lista";

  const [{ data: user }, { data: resultados, error }, { data: banners }] =
    await Promise.all([
      supabase.auth.getUser().then((r) => ({ data: r.data.user })),
      supabase.rpc("marketplace_buscar", {
        p_texto: texto,
        p_ciudad: ciudad,
        p_categoria: categoria,
        p_orden: orden ?? "RELEVANCIA",
        p_limite: 24,
        p_lat: lat ? Number(lat) : undefined,
        p_lng: lng ? Number(lng) : undefined,
      }),
      // banner_home (Fase 3.2): RLS pública solo devuelve banners activos y
      // vigentes hoy — sin filtrar nada más acá.
      supabase.from("banner_home").select("id, imagen_url, texto, url_destino").order("orden"),
    ]);

  // Impresiones reales de Marketplace Ads (Módulo 6.2) — una por resultado
  // patrocinado mostrado en esta página. No se espera la respuesta: nunca
  // debe ralentizar el render de la búsqueda.
  const campanasEnPantalla = [...new Set((resultados ?? []).map((n) => n.campana_id).filter((id): id is string => Boolean(id)))];
  if (campanasEnPantalla.length > 0) {
    void Promise.all(campanasEnPantalla.map((id) => supabase.rpc("registrar_impresion_patrocinada", { p_campana_id: id })));
  }

  // "Disponible hoy" se aplica sobre la página ya traída: `proxima_disponibilidad`
  // se calcula por fila y no es un criterio indexable. Con catálogos grandes esto
  // pasa al Score del Marketplace (08-Growth-Monetization/01_Marketplace_Algorithm.md).
  const negocios = soloHoy
    ? (resultados ?? []).filter(
        (n) =>
          n.proxima_disponibilidad !== null &&
          n.proxima_disponibilidad.slice(0, 10) <= hoyISO()
      )
    : (resultados ?? []);

  const hayFiltros = Boolean(texto || ciudad || categoria || soloHoy);

  function urlConVista(nuevaVista: "lista" | "mapa") {
    const siguiente = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (clave === "vista" || typeof valor !== "string") continue;
      siguiente.set(clave, valor);
    }
    siguiente.set("vista", nuevaVista);
    return `?${siguiente.toString()}`;
  }

  const patrocinados = vista === "lista" && !hayFiltros ? negocios.filter((n) => n.patrocinado) : [];
  const resto = patrocinados.length > 0 ? negocios.filter((n) => !n.patrocinado) : negocios;
  const grilla = "grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3";

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))]">
      <Header autenticado={Boolean(user)} etiqueta="01 / Explorar" />

      <main className="mx-auto w-full max-w-5xl flex-1">
        {!hayFiltros && vista === "lista" ? (
          <>
            <div className="relative">
              <h1 className="poster-1 px-4 pb-4 pt-3 sm:px-6">
                Tu barbero.
                <br />
                Tu hora.
                <br />
                <span className="sn-hot">Sin fila.</span>
              </h1>
              <Sello className="absolute bottom-3 right-4" />
            </div>
            <nav aria-label="Categorías" className="p-grid2 sm:!grid-cols-4">
              {CATEGORIAS_HOME.map((c, i) => (
                <Link key={c.valor} href={`/?categoria=${c.valor}`} className="min-h-12 no-underline">
                  <Num>{String(i + 1).padStart(2, "0")} /</Num>
                  <span className="section !text-[13px]">{c.etiqueta}</span>
                </Link>
              ))}
            </nav>
            <Marquee text="Reserva en 30 segundos ✶ Sin filas ni llamadas ✶ Tu barbero favorito te espera ✶ Gana puntos en cada corte ✶ Paga seguro desde el celular" tone="ink" />
          </>
        ) : null}

        {banners && banners.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 px-4 pt-4 sm:grid-cols-2 sm:px-6">
            {banners.map((b) => {
              const contenido = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagen editorial de SuperSU, URL arbitraria (no forma parte del set de dominios optimizables de next/image) */}
                  <img src={b.imagen_url} alt={b.texto ?? ""} className="h-32 w-full object-cover grayscale" />
                  {b.texto ? <span className="sn-label block bg-ink px-3 py-2 text-paper">{b.texto}</span> : null}
                </>
              );
              return b.url_destino ? (
                <a key={b.id} href={b.url_destino} className="block min-w-0 border-2 border-border no-underline">
                  {contenido}
                </a>
              ) : (
                <div key={b.id} className="min-w-0 border-2 border-border">
                  {contenido}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="px-4 pt-4 sm:px-6">
          <Suspense fallback={<div className="mb-6 h-12 animate-pulse border-2 border-border bg-surface-2" aria-hidden />}>
            <Filtros />
          </Suspense>
        </div>

        <div className="p-sec flex-wrap gap-3 sm:!px-6">
          <span className="sn-num">
            {hayFiltros ? "02 / Resultados" : vista === "mapa" ? "02 / Mapa" : "02 / Negocios destacados"}
          </span>
          {/* Vista alternable lista/mapa (02-UX/04_Marketplace.md) — el resto
              de los filtros de la URL se conservan al alternar. */}
          <div className="flex gap-2" role="group" aria-label="Vista">
            <Link
              href={urlConVista("lista")}
              aria-current={vista === "lista" ? "true" : undefined}
              className={`sn-chip !min-h-12 no-underline ${vista === "lista" ? "is-selected" : ""}`}
            >
              Lista
            </Link>
            <Link
              href={urlConVista("mapa")}
              aria-current={vista === "mapa" ? "true" : undefined}
              className={`sn-chip !min-h-12 no-underline ${vista === "mapa" ? "is-selected" : ""}`}
            >
              Mapa ↗
            </Link>
          </div>
        </div>

        {error ? (
          <div className="px-4 sm:px-6">
            <EmptyState big="Error" title="No pudimos cargar el listado" hint={error.message} action={<Link href="/" className="sn-chip !min-h-12 no-underline">Reintentar</Link>} />
          </div>
        ) : negocios.length === 0 ? (
          <div className="px-4 sm:px-6">
            <EmptyState
              big="0"
              title={hayFiltros ? "Ningún negocio coincide con tu búsqueda" : "Aún no hay negocios activos por aquí"}
              hint={
                hayFiltros
                  ? "Probá quitando algún filtro o buscando por otro nombre."
                  : "Los negocios aprobados por SuperSU aparecerán en este listado automáticamente."
              }
              action={hayFiltros ? <Link href="/" className="sn-chip !min-h-12 no-underline">Quitar filtros</Link> : undefined}
            />
          </div>
        ) : vista === "mapa" ? (
          <MapaMarketplaceLazy negocios={negocios} centroInicial={lat && lng ? { lat: Number(lat), lng: Number(lng) } : null} />
        ) : (
          <>
            {patrocinados.length > 0 ? (
              <>
                <div className="p-sec sm:!px-6">
                  <span className="sn-num">03 / Patrocinado</span>
                </div>
                <div className={grilla}>
                  {patrocinados.map((n, i) => (
                    <NegocioCard key={n.id} negocio={n} index={i + 1} />
                  ))}
                </div>
              </>
            ) : null}
            {resto.length > 0 ? (
              <>
                {patrocinados.length > 0 ? (
                  <div className="p-sec sm:!px-6">
                    <span className="sn-num">04 / {lat && lng ? "Cerca de ti" : "Todos"}</span>
                  </div>
                ) : null}
                <div className={grilla}>
                  {resto.map((n, i) => (
                    <NegocioCard key={n.id} negocio={n} index={i + 1} />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
