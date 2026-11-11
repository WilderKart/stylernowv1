import { Label, Marquee, Meta, Num, Photo, ProCard, Stars, Status } from "@/components/brutal";
import { FOTOS_RESPALDO, FOTO_NEGOCIO_RESPALDO, nivelATier } from "@/components/negocio/nivel";
import { horarioDeHoy } from "@/components/negocio/horario";
import { duracion, TZ_POR_DEFECTO } from "@/lib/formato";
import { resumenPoliticaCancelacion } from "@/lib/pagos/sena";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerMarcaPublica } from "@/lib/marca/obtener-marca";
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
        .select("id, nombre, direccion, ciudad, latitud, longitud, zona_horaria, horario_base")
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
  const searchParams = await props.searchParams;
  const campanaId = typeof searchParams.campana_id === "string" ? searchParams.campana_id : null;
  const datos = await cargarNegocio(slug);
  if (!datos) notFound();

  const { negocio, sedes, servicios, staff, resenas, promedio } = datos;
  const sede = sedes[0];
  const horarioHoy = sede ? horarioDeHoy(sede.horario_base, sede.zona_horaria ?? TZ_POR_DEFECTO) : null;
  const favoritoInicial = await esFavorito(negocio.id);

  // Conversión_normalizada (08-Growth-Monetization/01_Marketplace_Algorithm.md)
  // se calcula sobre visitas reales al perfil — sin este registro, ese
  // componente del Score queda inerte para siempre. Se espera la respuesta
  // (una sola escritura indexada, latencia despreciable) para no arriesgar
  // perderla si el proceso termina apenas se envía la respuesta HTTP.
  const supabaseVisita = await createClient();
  await supabaseVisita.rpc("registrar_visita_perfil", { p_negocio_id: negocio.id, p_campana_id: campanaId ?? undefined });

  // Lealtad transversal (ADR-011 + extensión del fundador): insignia VIP
  // del propio Cliente en ESTE Negocio — nunca su nivel en otro Negocio.
  const {
    data: { user: usuarioVip },
  } = await supabaseVisita.auth.getUser();
  let miNivelVip: string | null = null;
  if (usuarioVip) {
    const { data: vipData } = await supabaseVisita
      .from("vip_miembro")
      .select("vip_nivel:nivel_id (nombre)")
      .eq("cliente_id", usuarioVip.id)
      .eq("negocio_id", negocio.id)
      .maybeSingle();
    miNivelVip = (vipData?.vip_nivel as unknown as { nombre: string } | null)?.nombre ?? null;
  }

  // Solo se ofrece el link a Membresías si el Negocio tiene al menos un
  // plan activo — nunca un link muerto hacia una lista vacía (Regla de Oro).
  const { count: planesMembresiaCount } = await supabaseVisita
    .from("membresia_plan")
    .select("id", { count: "exact", head: true })
    .eq("negocio_id", negocio.id)
    .eq("activo", true);
  const tieneMembresias = (planesMembresiaCount ?? 0) > 0;

  // Marketplace Ads (Módulo 6.2): un clic en un resultado patrocinado se
  // cobra en tiempo real contra el Wallet del propio Negocio anunciante.
  if (campanaId) {
    await supabaseVisita.rpc("registrar_clic_patrocinado", { p_campana_id: campanaId, p_negocio_id: negocio.id });
  }

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

  const sinDisponibilidad = servicios.length === 0 || sedes.length === 0;
  const marca = await obtenerMarcaPublica(negocio.id);
  // Mi Marca publicada: el nombre y el logo de marca sustituyen a los del negocio en la portada.
  const nombreVisible = marca?.nombreMarca ?? negocio.nombre;
  const partesNombre = nombreVisible.split(" ");
  const mitad = Math.ceil(partesNombre.length / 2);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-bg"
      // Mi Marca (add-on): el negocio redefine su acento y su tinta; los colores ya vienen validados #RRGGBB.
      style={marca ? ({ "--signal": marca.colorPrimario, "--ink": marca.colorSecundario } as React.CSSProperties) : undefined}
    >
      {marca?.slogan ? (
        <p className="sn-label bg-signal px-4 py-2 text-ink">{marca.slogan}</p>
      ) : null}
      <script
        type="application/ld+json"
        // Los textos (nombre, dirección, servicios) los escribe el negocio: se escapa "<" para que ningún valor pueda
        // cerrar la etiqueta <script> (XSS almacenado). < es JSON válido y los buscadores lo leen igual.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <main className="flex-1">
        {/* ── Portada ───────────────────────────────────────────────── */}
        <div className="relative">
          <Photo
            src={marca?.logoUrl ?? negocio.logo_url ?? FOTO_NEGOCIO_RESPALDO}
            alt={nombreVisible}
            className="h-[250px] w-full"
          />
          <Link
            href="/"
            aria-label="Volver"
            className="sn-iconbtn absolute top-2 left-2 border-2 border-ink bg-paper text-ink"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <BotonCompartir nombre={negocio.nombre} slug={negocio.slug} />
          <BotonFavorito negocioId={negocio.id} slug={negocio.slug} favoritoInicial={favoritoInicial} />
        </div>

        <div className="px-4 pt-3.5 pb-1.5">
          <Num>
            {negocio.categoria.join(" · ") || "Negocio"} · {negocio.ciudad}
          </Num>
        </div>
        <h1 className="poster-1 px-4 pb-3 break-words">
          {partesNombre.slice(0, mitad).join(" ")}
          {partesNombre.length > 1 ? <br /> : null}
          {partesNombre.slice(mitad).join(" ")}
          {"."}
        </h1>
        {miNivelVip ? (
          <div className="px-4 pb-3">
            <Status tone="ok">Sos {miNivelVip} acá</Status>
          </div>
        ) : null}

        <div className="sn-gridcols grid-cols-3 border-b-2 border-line">
          <div className="min-w-0">
            <Meta>Rating</Meta>
            <div className="sn-fig text-[22px]">
              {resenas.length > 0 ? `★ ${promedio.toFixed(1).replace(".", ",")}` : "—"}
            </div>
          </div>
          <div className="min-w-0">
            <Meta>Reseñas</Meta>
            <div className="sn-fig text-[22px]">{resenas.length}</div>
          </div>
          <div className="min-w-0">
            <Meta>Servicios</Meta>
            <div className="sn-fig text-[22px]">{servicios.length}</div>
          </div>
        </div>

        <Marquee tone="signal" text={`Reserva tu turno en ${negocio.ciudad} ✶ Elige profesional y hora ✶ Confirmación al instante ✶ Cancela fácil si cambias de plan`} />

        {negocio.descripcion ? (
          <p className="body-sm m-0 px-4 pt-4 break-words">{negocio.descripcion}</p>
        ) : null}

        {sede ? (
          <div className="mx-4 mt-4 border-2 border-line p-3">
            <Label>{sede.nombre}</Label>
            <p className="body-sm m-0 mt-1 break-words">
              {sede.direccion} · {sede.ciudad}
            </p>
            {horarioHoy ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="sn-label">{horarioHoy.etiqueta}</span>
                {horarioHoy.abiertoAhora ? <Status tone="ok">Abierto ahora</Status> : null}
              </div>
            ) : null}
            {sede.latitud && sede.longitud ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${sede.latitud},${sede.longitud}`}
                target="_blank"
                rel="noreferrer"
                className="sn-label inline-flex min-h-12 items-center underline"
              >
                Ver en el mapa ↗
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-x-4 px-4 pt-2">
          {tieneMembresias ? (
            <Link
              href={`/negocio/${negocio.slug}/membresias`}
              className="sn-label inline-flex min-h-12 items-center underline"
            >
              Ver membresías →
            </Link>
          ) : null}
          <Link
            href={`/gift-cards/comprar?negocio=${negocio.slug}`}
            className="sn-label inline-flex min-h-12 items-center underline"
          >
            Regalar gift card →
          </Link>
        </div>

        {/* ── 01 Servicios ──────────────────────────────────────────── */}
        <div className="p-sec">
          <Num>01 / Servicios</Num>
        </div>
        {servicios.length === 0 ? (
          <div className="mx-4 border-2 border-dashed border-line p-6 text-center">
            <Meta>Este negocio todavía no publicó su lista de servicios.</Meta>
          </div>
        ) : (
          <ul className="m-0 list-none border-t-2 border-line p-0">
            {servicios.map((s) => (
              <li key={s.id} className="border-b border-grid-soft px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <b className="body min-w-0 break-words">{s.nombre}</b>
                  <Meta>{duracion(s.duracion_minutos)}</Meta>
                </div>
                {s.descripcion ? <p className="body-sm m-0 mt-1 break-words">{s.descripcion}</p> : null}
                <div className="mt-2">
                  <span className="sn-price">{formatCOP(s.precio_base)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ── 02 Equipo ─────────────────────────────────────────────── */}
        {staff.length > 0 ? (
          <>
            <div className="p-sec">
              <Num>02 / Equipo</Num>
            </div>
            <div className="p-stack px-4">
              {staff.map((p, i) => (
                <ProCard
                  key={p.staff_id}
                  href={`/negocio/${negocio.slug}/profesional/${p.staff_id}`}
                  name={p.nombre}
                  role={p.especialidad ?? undefined}
                  tier={nivelATier(p.nivel)}
                  photo={p.foto_url ?? FOTOS_RESPALDO[i % FOTOS_RESPALDO.length]}
                />
              ))}
            </div>
          </>
        ) : null}

        {/* ── 03 Reseñas ────────────────────────────────────────────── */}
        <div className="p-sec">
          <Num>03 / Reseñas · {resenas.length}</Num>
        </div>
        {resenas.length === 0 ? (
          <div className="mx-4 border-2 border-dashed border-line p-6 text-center">
            <Meta>Todavía no hay reseñas. Solo quien completó una cita puede dejar una.</Meta>
          </div>
        ) : (
          <div className="p-stack px-4">
            {resenas.map((r) => (
              <div key={r.id} className="sn-review">
                <div className="sn-review__head">
                  <Label className="min-w-0 break-words">{r.cliente_nombre}</Label>
                  <Stars value={r.calificacion} />
                </div>
                <div className="sn-review__body">
                  {r.comentario ? <p className="body-sm m-0 break-words">{r.comentario}</p> : null}
                  <Meta>Cita verificada</Meta>
                </div>
                {r.respuesta_negocio ? (
                  <div className="sn-review__reply">
                    <b className="sn-label">Respuesta de {negocio.nombre}</b>
                    <br />
                    {r.respuesta_negocio}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* ── 04 Política de cancelación ────────────────────────────── */}
        <div className="p-sec">
          <Num>04 / Política de cancelación</Num>
        </div>
        <ul className="body-sm m-0 mb-4 flex list-none flex-col gap-1.5 px-4">
          {resumenPoliticaCancelacion(negocio).map((linea) => (
            <li key={linea}>{linea}</li>
          ))}
        </ul>
      </main>

      {/* CTA principal fijo (02-UX/04_Marketplace.md). */}
      <div className="p-foot">
        {sinDisponibilidad ? (
          <span className="sn-btn sn-btn--secondary w-full justify-center" aria-disabled="true">
            Sin disponibilidad publicada
          </span>
        ) : (
          <Link href={`/negocio/${negocio.slug}/reservar`} className="sn-btn sn-btn--primary w-full">
            <span>Reservar turno</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
              <path d="M7 17 17 7M7 7h10v10" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
