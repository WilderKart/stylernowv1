import { Pantalla, Top, ErrorAviso, diaYMes } from "@/app/lealtad/ui-cliente";
import { EmptyState, Photo } from "@/components/brutal";
import { listarMyLook, type FotoMyLook } from "@/lib/cliente/mylook-pagos";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotonCompartir } from "./boton-compartir";

export const metadata = { title: "My Look", robots: { index: false, follow: false } };

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

function Foto({ f, etiqueta }: { f: FotoMyLook | null; etiqueta: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Photo src={f?.url_firmada} alt={f ? `${etiqueta} de tu cita` : ""} className="aspect-[3/4] w-full" />
      <span className="p-phl">{etiqueta}</span>
    </div>
  );
}

export default async function MyLookPage(props: PageProps<"/mi-look">) {
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
      <Top titulo="/Perfil/My-Look" volverA="/perfil" derecha={<span className="sn-label px-2">Prestige</span>} />

      <div className="p-4">
        <h1 className="poster-2 break-words">
          My Look<span className="sn-hot">.</span>
        </h1>
        <p className="body-sm mt-2 break-words">Antes y después de cada cita. Solo tú los ves hasta que compartes.</p>
      </div>

      {!res.ok ? (
        <div className="px-4">
          <ErrorAviso>{res.error}</ErrorAviso>
        </div>
      ) : !actual || !base ? (
        <div className="px-4">
          <EmptyState
            big="Sin fotos"
            title="Aún no tienes fotos"
            hint="Cuando tu profesional suba el antes y el después de una cita, con tu consentimiento, aparecerán aquí."
            action={
              <Link href="/mis-reservas" className="sn-btn sn-btn--primary sn-btn--block no-underline">
                <span>Ver mis citas</span>
                <span aria-hidden>↗</span>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="mx-4 border-2 border-line" aria-label="Cita seleccionada">
            <div className="flex gap-0.5 border-b-2 border-line bg-line">
              <Foto f={actual.antes} etiqueta="Antes" />
              <Foto f={actual.despues} etiqueta="Después" />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 p-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="section break-words">{base.servicios ?? "Servicio"}</div>
                <div className="sn-meta mt-1 break-words">
                  {fechaCorta(base.hora_inicio)}
                  {base.staff_nombre ? ` · ${base.staff_nombre}` : ""} · {base.negocio_nombre}
                </div>
              </div>
              <BotonCompartir fotoIds={actual.fotos.map((f) => f.foto_id)} compartida={actual.fotos.every((f) => f.compartida)} />
            </div>
          </section>

          <div className="p-sec">
            <h2 className="sn-num">Historial</h2>
            <span className="sn-label">
              {citas.length} {citas.length === 1 ? "cita" : "citas"}
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
