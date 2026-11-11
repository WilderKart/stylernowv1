import { Chip, Meta, Num, Photo, Tier } from "@/components/brutal";
import { FOTOS_RESPALDO, nivelATier } from "@/components/negocio/nivel";
import { duracion } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * Perfil público de un profesional. Solo datos que ya expone `negocio_staff_publico`
 * (vínculo ACTIVO con el negocio del slug; sin email, teléfono ni comisión).
 * El nivel es solo prestigio visual: el precio sigue siendo `servicio.precio_base`.
 */
async function cargarProfesional(slug: string, staffId: string) {
  const supabase = await createClient();

  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, nombre, slug")
    .eq("slug", slug)
    .eq("estado", "ACTIVO")
    .maybeSingle();
  if (!negocio) return null;

  const [{ data: staff }, { data: servicios }] = await Promise.all([
    supabase.rpc("negocio_staff_publico", { p_negocio_id: negocio.id }),
    supabase
      .from("servicio")
      .select("id, nombre, descripcion, duracion_minutos, precio_base")
      .eq("negocio_id", negocio.id)
      .eq("estado", "ACTIVO")
      .order("precio_base"),
  ]);

  // La RPC solo devuelve vínculos ACTIVO de este negocio: si no está, es 404.
  const indice = (staff ?? []).findIndex((p) => p.staff_id === staffId);
  if (indice < 0) return null;
  const profesional = staff![indice];

  const ids = new Set(profesional.servicio_ids ?? []);
  return {
    negocio,
    profesional,
    indice,
    servicios: (servicios ?? []).filter((s) => ids.has(s.id)),
  };
}

export async function generateMetadata(
  props: PageProps<"/negocio/[slug]/profesional/[staffId]">
): Promise<Metadata> {
  const { slug, staffId } = await props.params;
  const datos = await cargarProfesional(slug, staffId);
  if (!datos) return { title: "Profesional no disponible" };
  return {
    title: `${datos.profesional.nombre} · ${datos.negocio.nombre}`,
    description: `Reserva con ${datos.profesional.nombre} en ${datos.negocio.nombre}.`,
  };
}

export default async function ProfesionalPage(props: PageProps<"/negocio/[slug]/profesional/[staffId]">) {
  const { slug, staffId } = await props.params;
  const datos = await cargarProfesional(slug, staffId);
  if (!datos) notFound();

  const { negocio, profesional, indice, servicios } = datos;
  const tier = nivelATier(profesional.nivel);
  const primerNombre = profesional.nombre.split(" ")[0];
  const puedeReservar = servicios.length > 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-bg">
      <main className="flex-1">
        <div className="relative">
          <Photo
            src={profesional.foto_url ?? FOTOS_RESPALDO[indice % FOTOS_RESPALDO.length]}
            alt={profesional.nombre}
            className="h-[300px] w-full"
          />
          <Link
            href={`/negocio/${negocio.slug}`}
            aria-label={`Volver a ${negocio.nombre}`}
            className="sn-iconbtn absolute top-2 left-2 border-2 border-ink bg-paper text-ink"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-4">
          {tier ? <Tier level={tier} /> : null}
          <Meta>
            {profesional.especialidad ?? "Profesional"} · {negocio.nombre}
          </Meta>
        </div>
        <h1 className="poster-1 px-4 pt-3 pb-4 break-words">{profesional.nombre}</h1>

        <div className="sn-gridcols grid-cols-2 border-b-2 border-line">
          <div className="min-w-0">
            <Meta>Servicios</Meta>
            <div className="sn-fig text-[22px]">{servicios.length}</div>
          </div>
          <div className="min-w-0">
            <Meta>Nivel</Meta>
            <div className="sn-fig text-[22px] break-words">{tier ? tier.toUpperCase() : "—"}</div>
          </div>
        </div>

        {profesional.especialidad ? (
          <>
            <div className="p-sec">
              <Num>01 / Especialidad</Num>
            </div>
            <div className="p-chips">
              <Chip>{profesional.especialidad}</Chip>
            </div>
          </>
        ) : null}

        <div className="p-sec">
          <Num>{profesional.especialidad ? "02" : "01"} / Servicios que realiza</Num>
        </div>
        {servicios.length === 0 ? (
          <div className="mx-4 border-2 border-dashed border-line p-6 text-center">
            <Meta>Este profesional todavía no tiene servicios publicados.</Meta>
          </div>
        ) : (
          <ul className="m-0 mb-4 list-none border-t-2 border-line p-0">
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
      </main>

      <div className="p-foot">
        {puedeReservar ? (
          <Link
            href={`/negocio/${negocio.slug}/reservar?staff=${profesional.staff_id}`}
            className="sn-btn sn-btn--primary w-full"
          >
            <span className="min-w-0 break-words">Reservar con {primerNombre}</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
              <path d="M7 17 17 7M7 7h10v10" />
            </svg>
          </Link>
        ) : (
          <span className="sn-btn sn-btn--secondary w-full justify-center" aria-disabled="true">
            Sin servicios para reservar
          </span>
        )}
      </div>
    </div>
  );
}
