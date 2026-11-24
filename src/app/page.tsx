import { patronSinTildes } from "@/lib/busqueda/sin-tildes";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { Portada } from "@/components/inicio/portada";
import { Filtros } from "@/components/marketplace/filtros";
import { SeleccionMapaProvider, ZonaFiltros } from "@/components/marketplace/seleccion-mapa";
import { MapaMarketplaceLazy } from "@/components/marketplace/mapa-marketplace-lazy";
import { NegocioCardPortada } from "@/components/marketplace/negocio-card-portada";
import { EmptyState } from "@/components/brutal";
import { buscarNegociosFiltrado } from "@/lib/cliente/profesionales";
import { registrarEventoAnuncio } from "@/lib/ads/registrar-evento";
import { limitar, ipDelLlamador } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";
import { obtenerT } from "@/lib/i18n/servidor";
import e from "./inicio.module.css";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("home.meta_titulo"), description: t("home.meta_desc") };
}

function primerValor(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function HomePage(props: PageProps<"/">) {
  const params = await props.searchParams;
  const t = await obtenerT();
  const supabase = await createClient();

  const texto = primerValor(params.q);
  const ciudad = primerValor(params.ciudad);
  const categoria = primerValor(params.categoria);
  const orden = primerValor(params.orden);
  const soloHoy = primerValor(params.hoy) === "1";
  const lat = primerValor(params.lat);
  const lng = primerValor(params.lng);
  const vista = primerValor(params.vista) === "mapa" ? "mapa" : "lista";
  // Paginación de la lista: 24 por página (se pide 1 extra para saber si hay página siguiente). El mapa trae hasta 100.
  const TAM_PAGINA = 24;
  const pagina = Math.min(500, Math.max(1, Math.floor(Number(primerValor(params.pagina))) || 1));
  const offsetPagina = vista === "lista" ? (pagina - 1) * TAM_PAGINA : 0;
  const limiteBusqueda = vista === "mapa" ? 100 : TAM_PAGINA + 1;

  const radio = Number(primerValor(params.radio));
  const calif = Number(primerValor(params.calif));
  const latN = lat ? Number(lat) : NaN;
  const lngN = lng ? Number(lng) : NaN;
  const conCoords = Number.isFinite(latN) && Number.isFinite(lngN);
  const radioKm = conCoords && Number.isFinite(radio) && radio > 0 ? radio : undefined;
  const califMin = Number.isFinite(calif) && calif > 0 ? calif : undefined;
  // Filtros avanzados (distancia, calificación mínima, abierto hoy) -> envoltorio con disponibilidad real.
  const avanzado = soloHoy || radioKm !== undefined || califMin !== undefined;
  const ordenValido = (["CALIFICACION", "PRECIO", "RECIENTE"] as const).find((o) => o === orden) ?? "RELEVANCIA";

  const busqueda = async () => {
    // SEC-13: el buscador (`marketplace_buscar`/`_filtrado`) es costoso y lo puede disparar
    // un anónimo. Límite de borde por IP (fail-open: una caída de la BD de cupos no puede
    // tumbar la portada pública).
    const cupo = await limitar("marketplace-busqueda", await ipDelLlamador(), 90, 60, { failClosed: true });
    if (!cupo.ok) return { data: [], error: { message: "Demasiadas búsquedas. Espera un momento e inténtalo de nuevo." } };
    if (avanzado) {
      const r = await buscarNegociosFiltrado({
        texto,
        ciudad,
        categoria,
        orden: ordenValido,
        lat: conCoords ? latN : undefined,
        lng: conCoords ? lngN : undefined,
        radioKm,
        califMin,
        abiertoHoy: soloHoy,
        limite: limiteBusqueda,
        offset: offsetPagina,
      });
      return r.ok
        ? { data: r.data.map((n) => ({ ...n, ciudad: n.ciudad ?? "" })), error: null }
        : { data: null, error: { message: r.error } };
    }
    const r = await supabase.rpc("marketplace_buscar", {
      p_texto: texto ? patronSinTildes(texto) || undefined : undefined,
      p_ciudad: ciudad,
      p_categoria: categoria,
      p_orden: orden ?? "RELEVANCIA",
      p_limite: limiteBusqueda,
      p_offset: offsetPagina,
      p_lat: lat ? Number(lat) : undefined,
      p_lng: lng ? Number(lng) : undefined,
    });
    return { data: r.data, error: r.error };
  };

  const [{ data: user }, { data: resultados, error }, { data: banners }] =
    await Promise.all([
      supabase.auth.getUser().then((r) => ({ data: r.data.user })),
      busqueda(),
      // banner_home (Fase 3.2): RLS pública solo devuelve banners activos y
      // vigentes hoy — sin filtrar nada más aquí.
      supabase.from("banner_home").select("id, imagen_url, texto, url_destino").order("orden"),
    ]);

  // Impresiones reales de Marketplace Ads (Módulo 6.2) — una por resultado
  // patrocinado mostrado en esta página. No se espera la respuesta: nunca
  // debe ralentizar el render de la búsqueda.
  const campanasEnPantalla = [...new Set((resultados ?? []).map((n) => n.campana_id).filter((id): id is string => Boolean(id)))];
  if (campanasEnPantalla.length > 0) {
    const { data: { user: usuarioImpresion } } = await supabase.auth.getUser();
    void Promise.all(campanasEnPantalla.map((id) => registrarEventoAnuncio("IMPRESION", id, null, usuarioImpresion?.id ?? null)));
  }

  // "Abierto hoy" lo resuelve la BD con disponibilidad real (marketplace_buscar_filtrado).
  const todosLosResultados = resultados ?? [];
  const hayPaginaSiguiente = vista === "lista" && todosLosResultados.length > TAM_PAGINA;
  const negocios = hayPaginaSiguiente ? todosLosResultados.slice(0, TAM_PAGINA) : todosLosResultados;

  const hayFiltros = Boolean(texto || ciudad || categoria || avanzado);
  // Portada (maqueta 2026-11-15): sin filtros ni mapa. Los filtros no se muestran ahí a quien aún no
  // ingresa; siguen intactos en resultados, en el mapa y para quien ya tiene sesión.
  const portada = !hayFiltros && vista === "lista";
  const mostrarFiltros = !portada || Boolean(user);

  function urlConVista(nuevaVista: "lista" | "mapa") {
    const siguiente = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (clave === "vista" || typeof valor !== "string") continue;
      siguiente.set(clave, valor);
    }
    siguiente.set("vista", nuevaVista);
    return `?${siguiente.toString()}`;
  }

  function urlPagina(n: number) {
    const siguiente = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (clave === "pagina" || typeof valor !== "string") continue;
      siguiente.set(clave, valor);
    }
    if (n > 1) siguiente.set("pagina", String(n));
    const qs = siguiente.toString();
    return qs ? `/?${qs}` : "/";
  }

  const patrocinados = vista === "lista" && !hayFiltros ? negocios.filter((n) => n.patrocinado) : [];
  const resto = patrocinados.length > 0 ? negocios.filter((n) => !n.patrocinado) : negocios;
  const grilla = "grid grid-cols-1 gap-4 px-[14px] sm:grid-cols-2 sm:px-6 lg:grid-cols-3";

  return (
    <div className={`flex min-h-dvh flex-col bg-app ${user || !portada ? "pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))]" : "pb-8"}`}>
      <Header autenticado={Boolean(user)} etiqueta={t("home.etiqueta")} />

      <SeleccionMapaProvider>
      <main className="mx-auto w-full max-w-5xl flex-1">
        {portada ? <Portada /> : null}

        {banners && banners.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 px-4 pt-4 sm:grid-cols-2 sm:px-6">
            {banners.map((b) => {
              const contenido = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagen editorial de SuperSU, URL arbitraria (no forma parte del set de dominios optimizables de next/image) */}
                  <img src={b.imagen_url} alt={b.texto ?? ""} className="h-32 w-full object-cover" />
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

        {mostrarFiltros ? (
          <div className={`px-4 sm:px-6 ${portada ? "pt-8" : "pt-4"}`}>
            {/* Con un negocio tocado en el mapa, su tarjeta ocupa el lugar de los filtros (X para volver). */}
            <ZonaFiltros>
              <Suspense fallback={<div className="mb-6 h-12 animate-pulse border-2 border-border bg-surface-2" aria-hidden />}>
                <Filtros />
              </Suspense>
            </ZonaFiltros>
          </div>
        ) : null}

        <div className={e.seccion}>
          {portada ? (
            <h2 className={e.titulo}>
              <span className={e.numero}>{t("home.num_destacados")}</span> {t("home.destacados")}
            </h2>
          ) : (
            <span className="sn-num">{hayFiltros ? t("home.sec_resultados") : t("home.sec_mapa")}</span>
          )}
          {/* Vista alternable lista/mapa (02-UX/04_Marketplace.md) — el resto
              de los filtros de la URL se conservan al alternar. */}
          <div className={e.vistas} role="group" aria-label={t("home.vista")}>
            <Link
              href={urlConVista("lista")}
              aria-current={vista === "lista" ? "true" : undefined}
              className={vista === "lista" ? `${e.vista} ${e.activa}` : e.vista}
            >
              {t("home.lista")}
            </Link>
            <Link
              href={urlConVista("mapa")}
              aria-current={vista === "mapa" ? "true" : undefined}
              className={vista === "mapa" ? `${e.vista} ${e.activa}` : e.vista}
            >
              {t("home.mapa_link")}
            </Link>
          </div>
        </div>

        {error ? (
          <div className="px-4 sm:px-6">
            <EmptyState big={t("home.error_big")} title={t("home.error_listado")} hint={error.message} action={<Link href="/" className="sn-chip !min-h-12 no-underline">{t("comun.reintentar")}</Link>} />
          </div>
        ) : negocios.length === 0 ? (
          <div className="px-4 sm:px-6">
            <EmptyState
              big="0"
              title={hayFiltros ? t("home.sin_resultados") : t("home.sin_negocios")}
              hint={
                hayFiltros
                  ? t("home.sin_resultados_hint")
                  : t("home.sin_negocios_hint")
              }
              action={hayFiltros ? <Link href="/" className="sn-chip !min-h-12 no-underline">{t("home.quitar_filtros")}</Link> : undefined}
            />
          </div>
        ) : vista === "mapa" ? (
          <MapaMarketplaceLazy negocios={negocios} centroInicial={lat && lng ? { lat: Number(lat), lng: Number(lng) } : null} />
        ) : (
          <>
            {patrocinados.length > 0 ? (
              <>
                <div className="p-sec sm:!px-6">
                  <span className="sn-num">{t("home.sec_patrocinado")}</span>
                </div>
                <div className={grilla}>
                  {patrocinados.map((n) => (
                    <NegocioCardPortada key={n.id} negocio={n} />
                  ))}
                </div>
              </>
            ) : null}
            {resto.length > 0 ? (
              <>
                {patrocinados.length > 0 ? (
                  <div className="p-sec sm:!px-6">
                    <span className="sn-num">{lat && lng ? t("home.sec_cerca") : t("home.sec_todos")}</span>
                  </div>
                ) : null}
                <div className={grilla}>
                  {resto.map((n) => (
                    <NegocioCardPortada key={n.id} negocio={n} />
                  ))}
                </div>
              </>
            ) : null}
            {pagina > 1 || hayPaginaSiguiente ? (
              <nav aria-label={t("home.paginacion")} className="flex items-center justify-between gap-3 px-4 py-6 sm:px-6">
                {pagina > 1 ? (
                  <Link href={urlPagina(pagina - 1)} className="sn-chip !min-h-12 no-underline">
                    {t("home.anteriores")}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="sn-num">{t("comun.pagina", { n: pagina })}</span>
                {hayPaginaSiguiente ? (
                  <Link href={urlPagina(pagina + 1)} className="sn-chip is-selected !min-h-12 no-underline">
                    {t("home.ver_mas")}
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}
      </main>
      </SeleccionMapaProvider>

      {/* Quien aún no ingresa ve la portada limpia (maqueta): la barra inferior es del Cliente con sesión. */}
      {user || !portada ? <BottomNav /> : null}
    </div>
  );
}
