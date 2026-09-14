import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { Filtros } from "@/components/marketplace/filtros";
import { NegocioCard } from "@/components/marketplace/negocio-card";
import { hoyISO } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

export const metadata = {
  title: "Reserva tu cita",
  description:
    "Encuentra barberías, salones y spas cerca de ti y reserva tu turno en segundos.",
};

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

  const [{ data: user }, { data: resultados, error }, { data: ciudadesRaw }] =
    await Promise.all([
      supabase.auth.getUser().then((r) => ({ data: r.data.user })),
      supabase.rpc("marketplace_buscar", {
        p_texto: texto,
        p_ciudad: ciudad,
        p_categoria: categoria,
        p_orden: orden ?? "RELEVANCIA",
        p_limite: 24,
      }),
      supabase.from("negocio").select("ciudad").eq("estado", "ACTIVO"),
    ]);

  const ciudades = [...new Set((ciudadesRaw ?? []).map((c) => c.ciudad))].sort();

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

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-24">
      <Header autenticado={Boolean(user)} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 sm:px-10">
        <Suspense fallback={<div className="mb-6 h-[50px] rounded-2xl bg-surface" />}>
          <Filtros ciudades={ciudades} />
        </Suspense>

        <h2 className="font-display mb-4 text-base font-semibold uppercase tracking-wide text-text">
          {hayFiltros ? "Resultados" : "Negocios destacados"}
        </h2>

        {error ? (
          <div className="rounded-2xl border border-danger/40 bg-danger-soft p-5 text-center">
            <p className="text-sm font-semibold text-text">No pudimos cargar el listado</p>
            <p className="mt-1 text-xs text-text-muted">{error.message}</p>
          </div>
        ) : negocios.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
            <p className="mb-1 text-sm font-semibold text-text">
              {hayFiltros
                ? "Ningún negocio coincide con tu búsqueda"
                : "Aún no hay negocios activos por aquí"}
            </p>
            <p className="max-w-[300px] text-xs text-text-faint">
              {hayFiltros
                ? "Probá quitando algún filtro o buscando por otro nombre."
                : "Los negocios aprobados por SuperSU aparecerán en este listado automáticamente."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {negocios.map((n) => (
              <NegocioCard key={n.id} negocio={n} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
