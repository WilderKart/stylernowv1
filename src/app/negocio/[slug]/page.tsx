import { BarraSuperior } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Rating } from "@/components/ui/rating";
import { duracion } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { esFavorito } from "./actions";
import { BotonCompartir } from "./boton-compartir";
import { BotonFavorito } from "./boton-favorito";

async function cargarNegocio(slug: string) {
  const supabase = await createClient();

  // RLS `negocio_select_publico` ya limita a estado ACTIVO: un Negocio suspendido
  // devuelve 404, no una página rota (02-UX/04_Marketplace.md, caso límite).
  const { data: negocio } = await supabase
    .from("negocio")
    .select(
      "id, nombre, slug, descripcion, ciudad, categoria, logo_url, ventana_reembolso_total_horas, ventana_reembolso_parcial_horas, reembolso_parcial_pct"
    )
    .eq("slug", slug)
    .eq("estado", "ACTIVO")
    .maybeSingle();

  if (!negocio) return null;

  const [{ data: sedes }, { data: servicios }, { data: staff }, { data: resenas }] =
    await Promise.all([
      supabase
        .from("sede")
        .select("id, nombre, direccion, ciudad, latitud, longitud, zona_horaria")
        .eq("negocio_id", negocio.id)
        .eq("cerrada_permanente", false)
        .order("created_at"),
      supabase
        .from("servicio")
        .select("id, nombre, descripcion, duracion_minutos, precio_base")
        .eq("negocio_id", negocio.id)
        .eq("estado", "ACTIVO")
        .order("precio_base"),
      supabase.rpc("negocio_staff_publico", { p_negocio_id: negocio.id }),
      supabase.rpc("negocio_resenas_publicas", { p_negocio_id: negocio.id, p_limite: 8 }),
    ]);

  const calificaciones = (resenas ?? []).map((r) => r.calificacion);
  const promedio =
    calificaciones.length > 0
      ? calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length
      : 0;

  return {
    negocio,
    sedes: sedes ?? [],
    servicios: servicios ?? [],
    staff: staff ?? [],
    resenas: resenas ?? [],
    promedio,
  };
}

export async function generateMetadata(
  props: PageProps<"/negocio/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const datos = await cargarNegocio(slug);
  if (!datos) return { title: "Negocio no disponible" };

  const { negocio } = datos;
  const descripcion =
    negocio.descripcion ??
    `Reserva tu turno en ${negocio.nombre}, ${negocio.ciudad}. Disponibilidad en tiempo real.`;

  return {
    title: negocio.nombre,
    description: descripcion,
    alternates: { canonical: `/negocio/${negocio.slug}` },
    openGraph: {
      title: `${negocio.nombre} · StylerNow`,
      description: descripcion,
      type: "website",
      url: `/negocio/${negocio.slug}`,
      images: negocio.logo_url ? [negocio.logo_url] : undefined,
    },
  };
}

export default async function NegocioPage(props: PageProps<"/negocio/[slug]">) {
  const { slug } = await props.params;
  const datos = await cargarNegocio(slug);
  if (!datos) notFound();

  const { negocio, sedes, servicios, staff, resenas, promedio } = datos;
  const sede = sedes[0];
  const favoritoInicial = await esFavorito(negocio.id);

  // schema.org LocalBusiness: requisito explícito de SEO de 02-UX/04_Marketplace.md.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: negocio.nombre,
    description: negocio.descripcion ?? undefined,
    image: negocio.logo_url ?? undefined,
    address: sede
      ? {
          "@type": "PostalAddress",
          streetAddress: sede.direccion,
          addressLocality: sede.ciudad,
          addressCountry: "CO",
        }
      : undefined,
    geo:
      sede?.latitud && sede?.longitud
        ? { "@type": "GeoCoordinates", latitude: sede.latitud, longitude: sede.longitud }
        : undefined,
    aggregateRating:
      resenas.length > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: promedio.toFixed(1),
            reviewCount: resenas.length,
          }
        : undefined,
    makesOffer: servicios.map((s) => ({
      "@type": "Offer",
      name: s.nombre,
      price: s.precio_base,
      priceCurrency: "COP",
    })),
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <BarraSuperior titulo={negocio.nombre} volverA="/" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-5 sm:px-10">
        <div className="relative mb-5 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#3a2e1a] to-[#1a1512]">
          {negocio.logo_url ? (
            <Image
              src={negocio.logo_url}
              alt={negocio.nombre}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          ) : (
            <span className="font-display absolute inset-0 flex items-center justify-center text-5xl font-bold text-accent/30">
              {negocio.nombre.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[26px] font-bold uppercase leading-tight tracking-tight text-text">
            {negocio.nombre}
          </h1>
          <div className="mt-1 flex shrink-0 gap-2">
            <BotonFavorito negocioId={negocio.id} slug={negocio.slug} favoritoInicial={favoritoInicial} />
            <BotonCompartir nombre={negocio.nombre} slug={negocio.slug} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <Rating valor={promedio} total={resenas.length} size="md" />
          {negocio.categoria.map((c) => (
            <Badge key={c} tone="accent">
              {c}
            </Badge>
          ))}
        </div>
        {negocio.descripcion ? (
          <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
            {negocio.descripcion}
          </p>
        ) : null}

        {sede ? (
          <Card className="mt-4 flex items-start gap-3">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="#e8a23c"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
              <circle cx="12" cy="10" r="2.6" />
            </svg>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-text">{sede.nombre}</p>
              <p className="text-[12.5px] text-text-muted">
                {sede.direccion} · {sede.ciudad}
              </p>
              {sede.latitud && sede.longitud ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${sede.latitud},${sede.longitud}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[12.5px] font-semibold text-accent"
                >
                  Ver en el mapa
                </a>
              ) : null}
            </div>
          </Card>
        ) : null}

        {/* ── Servicios ─────────────────────────────────────────────── */}
        <section className="mt-7">
          <h2 className="font-display mb-3 text-base font-semibold uppercase tracking-wide text-text">
            Servicios
          </h2>
          {servicios.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs text-text-faint">
              Este negocio todavía no publicó su lista de servicios.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {servicios.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-text">{s.nombre}</p>
                    <p className="text-[12px] text-text-faint">
                      {duracion(s.duracion_minutos)}
                      {s.descripcion ? ` · ${s.descripcion}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[14px] font-bold text-accent">
                    {formatCOP(s.precio_base)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Profesionales ─────────────────────────────────────────── */}
        {staff.length > 0 ? (
          <section className="mt-7">
            <h2 className="font-display mb-3 text-base font-semibold uppercase tracking-wide text-text">
              Profesionales
            </h2>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 sm:mx-0 sm:px-0">
              {staff.map((p) => (
                <div key={p.staff_id} className="w-[110px] shrink-0 text-center">
                  <div className="relative mx-auto mb-2 size-[72px] overflow-hidden rounded-full bg-surface-2">
                    {p.foto_url ? (
                      <Image src={p.foto_url} alt="" fill sizes="72px" className="object-cover" />
                    ) : (
                      <span className="font-display absolute inset-0 flex items-center justify-center text-lg font-bold text-text-faint">
                        {p.nombre.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[12.5px] font-semibold text-text">{p.nombre}</p>
                  {p.especialidad ? (
                    <p className="truncate text-[11px] text-text-faint">{p.especialidad}</p>
                  ) : null}
                  {p.nivel ? (
                    <Badge tone="accent" className="mt-1">
                      {p.nivel}
                    </Badge>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Reseñas ───────────────────────────────────────────────── */}
        <section className="mt-7">
          <h2 className="font-display mb-3 text-base font-semibold uppercase tracking-wide text-text">
            Reseñas verificadas
          </h2>
          {resenas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs text-text-faint">
              Todavía no hay reseñas. Solo quien completó una cita puede dejar una.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {resenas.map((r) => (
                <li key={r.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-text">{r.cliente_nombre}</p>
                    <Rating valor={r.calificacion} total={1} />
                  </div>
                  {r.comentario ? (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                      {r.comentario}
                    </p>
                  ) : null}
                  {r.respuesta_negocio ? (
                    <p className="mt-2 border-l-2 border-accent/40 pl-3 text-[12.5px] text-text-faint">
                      <span className="font-semibold text-text-muted">Respuesta del negocio: </span>
                      {r.respuesta_negocio}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* CTA principal fijo (02-UX/04_Marketplace.md). */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          {servicios.length === 0 || sedes.length === 0 ? (
            <Button size="lg" className="w-full" disabled>
              SIN DISPONIBILIDAD PUBLICADA
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link href={`/negocio/${negocio.slug}/reservar`}>RESERVAR TURNO</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
