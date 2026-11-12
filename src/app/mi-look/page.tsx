import { Pantalla, Top, ErrorAviso, diaYMes } from "@/app/lealtad/ui-cliente";
import { EmptyState, Photo } from "@/components/brutal";
import { listarMyLook, type FotoMyLook } from "@/lib/cliente/mylook-pagos";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotonCompartir } from "./boton-compartir";
import { obtenerT } from "@/lib/i18n/servidor";
import type { Traductor } from "@/lib/i18n/diccionario";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("ml.meta"), robots: { index: false, follow: false } };
}

const TZ = "America/Bogota";

interface Cita {
  reservaId: string;
  antes: FotoMyLook | null;
  despues: FotoMyLook | null;
  fotos: FotoMyLook[];
}

function agrupar(fotos: FotoMyLook[]): Cita[] {
  const mapa = new Map<string, Cita>();
  for (const f of fotos) {
    let c = mapa.get(f.reserva_id);
    if (!c) {
      c = { reservaId: f.reserva_id, antes: null, despues: null, fotos: [] };
      mapa.set(f.reserva_id, c);
    }
    c.fotos.push(f);
    if (f.momento === "ANTES" && !c.antes) c.antes = f;
    else if (f.momento === "DESPUES" && !c.despues) c.despues = f;
  }
  return [...mapa.values()];
}

function fechaCorta(iso: string) {
  const { dia, mes } = diaYMes(iso, TZ);
  return `${Number(dia)} ${mes}`.toUpperCase();
}

function Foto({ f, etiqueta, t }: { f: FotoMyLook | null; etiqueta: string; t: Traductor }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Photo src={f?.url_firmada} alt={f ? t("ml.antes_de", { etiqueta }) : ""} className="aspect-[3/4] w-full" />
      <span className="p-phl">{etiqueta}</span>
    </div>
  );
}

export default async function MyLookPage(props: PageProps<"/mi-look">) {
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mi-look");

  const sp = await props.searchParams;
  const res = await listarMyLook();
  const citas = res.ok ? agrupar(res.data) : [];
  const pedida = typeof sp.cita === "string" ? sp.cita : null;
  const actual = citas.find((c) => c.reservaId === pedida) ?? citas[0] ?? null;
  const base = actual?.fotos[0];

  return (
    <Pantalla className="pb-10">
      <Top titulo={t("ml.top")} volverA="/perfil" derecha={<span className="sn-label px-2">Prestige</span>} />

      <div className="p-4">
        <h1 className="poster-2 break-words">
          My Look<span className="sn-hot">.</span>
        </h1>
        <p className="body-sm mt-2 break-words">{t("ml.txt")}</p>
      </div>

      {!res.ok ? (
        <div className="px-4">
          <ErrorAviso>{res.error}</ErrorAviso>
        </div>
      ) : !actual || !base ? (
        <div className="px-4">
          <EmptyState
            big={t("ml.sin_fotos")}
            title={t("ml.sin_fotos_titulo")}
            hint={t("ml.sin_fotos_hint")}
            action={
              <Link href="/mis-reservas" className="sn-btn sn-btn--primary sn-btn--block no-underline">
                <span>{t("ml.ver_citas")}</span>
                <span aria-hidden>↗</span>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="mx-4 border-2 border-line" aria-label={t("ml.cita_sel")}>
            <div className="flex gap-0.5 border-b-2 border-line bg-line">
              <Foto f={actual.antes} etiqueta={t("ml.antes")} t={t} />
              <Foto f={actual.despues} etiqueta={t("ml.despues")} t={t} />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 p-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="section break-words">{base.servicios ?? t("citas.servicio")}</div>
                <div className="sn-meta mt-1 break-words">
                  {fechaCorta(base.hora_inicio)}
                  {base.staff_nombre ? ` · ${base.staff_nombre}` : ""} · {base.negocio_nombre}
                </div>
              </div>
              <BotonCompartir fotoIds={actual.fotos.map((f) => f.foto_id)} compartida={actual.fotos.every((f) => f.compartida)} />
            </div>
          </section>

          <div className="p-sec">
            <h2 className="sn-num">{t("ml.historial")}</h2>
            <span className="sn-label">
              {citas.length === 1 ? t("ml.n_cita", { n: citas.length }) : t("ml.n_citas", { n: citas.length })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 px-4">
            {citas.map((c) => {
              const b = c.fotos[0];
              const activa = c.reservaId === actual.reservaId;
              return (
                <Link
                  key={c.reservaId}
                  href={`/mi-look?cita=${c.reservaId}`}
                  aria-current={activa ? "true" : undefined}
                  className={`block min-w-0 border-2 text-text no-underline ${activa ? "border-signal" : "border-line"}`}
                >
                  <div className="flex gap-0.5 bg-line">
                    <Photo src={c.antes?.url_firmada} className="aspect-[3/4] min-w-0 flex-1" />
                    <Photo src={c.despues?.url_firmada} className="aspect-[3/4] min-w-0 flex-1" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5 p-2">
                    <span className="sn-label break-words">{fechaCorta(b.hora_inicio)}</span>
                    <span className="sn-meta break-words">{b.staff_nombre ?? b.negocio_nombre}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Pantalla>
  );
}
