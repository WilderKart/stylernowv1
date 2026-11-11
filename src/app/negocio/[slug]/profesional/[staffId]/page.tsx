import { Chip, Meta, Num, Photo, Stars, Tier } from "@/components/brutal";
import { FOTOS_RESPALDO, nivelATier } from "@/components/negocio/nivel";
import { listarResenasProfesional, obtenerPerfilProfesional } from "@/lib/cliente/profesionales";
import { duracion, fechaISO, hora, hoyISO, sumarDias } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TAM_PAGINA_RESENAS } from "./constantes";
import { ResenasLista } from "./resenas-lista";

/**
 * Perfil público de un profesional (C05). Datos de `negocio_staff_publico` (vínculo ACTIVO con el
 * negocio del slug; sin email, teléfono ni comisión) + perfil/reseñas/portafolio de src/lib/cliente.
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

/** Próximos horarios libres del profesional (hoy + 2 días) con la misma RPC del flujo de reserva. */
async function cargarHorarios(negocioId: string, staffId: string, servicioId: string | undefined) {
  if (!servicioId) return [];
  try {
    const supabase = await createClient();
    const { data: sede } = await supabase
      .from("sede")
      .select("id, zona_horaria")
      .eq("negocio_id", negocioId)
      .eq("cerrada_permanente", false)
      .eq("cerrada_temporalmente", false)
      .limit(1)
      .maybeSingle();
    if (!sede) return [];
    const tz = sede.zona_horaria || undefined;
    const hoy = hoyISO(tz);
    const dias = [hoy, sumarDias(hoy, 1), sumarDias(hoy, 2)];
    const resp = await Promise.all(
      dias.map((fecha) =>
        supabase.rpc("slots_disponibles", { p_sede_id: sede.id, p_servicio_ids: [servicioId], p_fecha: fecha, p_staff_id: staffId })
      )
    );
    const ahora = Date.now();
    const out: { dia: string; hora: string }[] = [];
    resp.forEach((r, i) => {
      for (const sl of r.data ?? []) {
        if (!sl.disponible || new Date(sl.hora_inicio).getTime() <= ahora) continue;
        const f = fechaISO(sl.hora_inicio, tz);
        out.push({ dia: i === 0 ? "HOY" : i === 1 ? "MAÑ" : `${f.slice(8)}/${f.slice(5, 7)}`, hora: hora(sl.hora_inicio, tz) });
      }
    });
    return out.slice(0, 8);
  } catch {
    return [];
  }
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
  const [perfilR, resenasR, horarios] = await Promise.all([
    obtenerPerfilProfesional(negocio.id, staffId),
    listarResenasProfesional(negocio.id, staffId, { limite: TAM_PAGINA_RESENAS, offset: 0 }),
    cargarHorarios(negocio.id, staffId, servicios[0]?.id),
  ]);
  const perfil = perfilR.ok ? perfilR.data : null;
  const resenas = resenasR.ok ? resenasR.data : [];

  const tier = nivelATier(profesional.nivel);
  const primerNombre = profesional.nombre.split(" ")[0];
  const puedeReservar = servicios.length > 0;
  const nota = perfil?.nota ?? null;
  const totalResenas = perfil?.total_resenas ?? 0;
  const dist = perfil?.distribucion;
  const maxDist = dist ? Math.max(1, ...Object.values(dist)) : 1;
  const portafolio = perfil?.portafolio ?? [];
  const desde = perfil?.precio_desde ?? (servicios.length ? Math.min(...servicios.map((s) => s.precio_base)) : null);
  const reservarHref = `/negocio/${negocio.slug}/reservar?staff=${profesional.staff_id}`;
  const notaTxt = nota !== null ? nota.toFixed(1).replace(".", ",") : "—";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col overflow-x-hidden bg-bg">
      <main className="flex-1">
        <div className="relative">
          <Photo
            src={profesional.foto_url ?? FOTOS_RESPALDO[indice % FOTOS_RESPALDO.length]}
            alt={profesional.nombre}
            className="h-[300px] w-full grayscale"
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
            {perfil?.negocio.ciudad ? ` · ${perfil.negocio.ciudad}` : ""}
          </Meta>
        </div>
        <h1 className="poster-1 px-4 pt-3 pb-4 break-words">{profesional.nombre}</h1>

        <div className="sn-gridcols grid-cols-3 border-b-2 border-line">
          <div className="min-w-0">
            <Meta>Cortes</Meta>
            <div className="sn-fig text-[22px]">{perfil ? perfil.cortes.toLocaleString("es-CO") : "—"}</div>
          </div>
          <div className="min-w-0">
            <Meta>Años</Meta>
            <div className="sn-fig text-[22px]">{perfil ? perfil.anios : "—"}</div>
          </div>
          <div className="min-w-0">
            <Meta>Nota · {totalResenas}</Meta>
            <div className="sn-fig text-[22px]">{notaTxt}</div>
          </div>
        </div>

        {perfil?.bio ? <p className="body m-0 px-4 py-4 break-words">{perfil.bio}</p> : null}

        <div className="p-sec">
          <Num>01 / Próximos horarios</Num>
          {puedeReservar ? (
            <Link href={reservarHref} className="sn-label no-underline">
              AGENDA ↗
            </Link>
          ) : null}
        </div>
        {horarios.length === 0 ? (
          <div className="mx-4 mb-4 border-2 border-dashed border-line p-4 text-center">
            <Meta>Sin horarios libres en los próximos días. Revisa la agenda completa.</Meta>
          </div>
        ) : (
          <div className="p-chips">
            {horarios.map((h, i) => (
              <Link key={`${h.dia}${h.hora}`} href={reservarHref} className={`sn-chip no-underline ${i === 0 ? "is-selected" : ""}`}>
                {h.dia} {h.hora}
              </Link>
            ))}
          </div>
        )}

        <div className="p-sec">
          <Num>02 / Portafolio</Num>
          <Meta>
            {portafolio.length} {portafolio.length === 1 ? "trabajo" : "trabajos"}
          </Meta>
        </div>
        {portafolio.length === 0 ? (
          <div className="mx-4 mb-4 border-2 border-dashed border-line p-6 text-center">
            <Meta>Todavía no hay trabajos compartidos por clientes.</Meta>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 px-4 pb-4">
            {portafolio.map((f) => (
              <div key={f.foto_id} className="relative aspect-square min-w-0 overflow-hidden border-2 border-line">
                <Photo src={f.url} alt={`Trabajo de ${profesional.nombre}`} className="h-full w-full grayscale" />
                {f.momento ? (
                  <span className="sn-label absolute bottom-0 left-0 bg-ink px-1.5 py-0.5 text-[10px] text-paper">
                    {f.momento === "ANTES" ? "ANTES" : "DESPUÉS"}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {profesional.especialidad ? (
          <div className="p-chips">
            <Chip>{profesional.especialidad}</Chip>
          </div>
        ) : null}

        <div className="p-sec">
          <Num>03 / Reseñas de {primerNombre}</Num>
          <Meta>{totalResenas}</Meta>
        </div>
        {totalResenas > 0 && nota !== null && dist ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pb-4">
            <div>
              <div className="sn-fig text-[40px]">{notaTxt}</div>
              <Stars value={nota} />
              <Meta className="block">de 5 · {totalResenas} reseñas</Meta>
            </div>
            <div className="flex min-w-[180px] flex-1 flex-col gap-1">
              {(["5", "4", "3", "2", "1"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="sn-meta w-3">{k}</span>
                  <span className="h-2 min-w-0 flex-1 border border-line">
                    <span className="block h-full bg-signal" style={{ width: `${Math.round((dist[k] / maxDist) * 100)}%` }} />
                  </span>
                  <span className="sn-meta w-8 text-right">{dist[k]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <ResenasLista slug={negocio.slug} staffId={profesional.staff_id} iniciales={resenas} total={totalResenas || resenas.length} />

        <div className="p-sec">
          <Num>04 / Servicios que realiza</Num>
        </div>
        {servicios.length === 0 ? (
          <div className="mx-4 mb-4 border-2 border-dashed border-line p-6 text-center">
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

      <div className="p-foot flex items-center gap-3">
        {desde !== null ? (
          <div className="shrink-0">
            <Meta className="block">Desde</Meta>
            <span className="sn-price">{formatCOP(desde)}</span>
          </div>
        ) : null}
        {puedeReservar ? (
          <Link href={reservarHref} className="sn-btn sn-btn--primary min-w-0 flex-1">
            <span className="min-w-0 break-words">Reservar con {primerNombre}</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
              <path d="M7 17 17 7M7 7h10v10" />
            </svg>
          </Link>
        ) : (
          <span className="sn-btn sn-btn--secondary min-w-0 flex-1 justify-center" aria-disabled="true">
            Sin servicios para reservar
          </span>
        )}
      </div>
    </div>
  );
}
