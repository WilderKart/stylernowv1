import { Pantalla, Top, ErrorAviso } from "@/app/lealtad/ui-cliente";
import { EmptyState } from "@/components/brutal";
import { obtenerBeneficiosMarcas, ofertasCercanas, type OfertaCercana } from "@/lib/cliente/ofertas";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CasillaMarcas } from "./casilla-marcas";
import { UsarUbicacion } from "./usar-ubicacion";

export const metadata = { title: "Ofertas cerca", robots: { index: false, follow: false } };

const RADIO_KM = 2;
const DIAS = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

function num(v: string | string[] | undefined, min: number, max: number) {
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function descuento(o: OfertaCercana) {
  if (o.tipo_descuento === "DOS_POR_UNO") return "2×1";
  if (o.valor == null) return "OFERTA";
  return o.tipo_descuento === "PORCENTAJE" ? `−${o.valor} %` : `−$ ${new Intl.NumberFormat("es-CO").format(o.valor)}`;
}

const FONDOS = ["var(--signal)", "var(--warning)", "var(--success)"];

function meta(o: OfertaCercana) {
  const partes = [o.negocio_nombre];
  if (o.distancia_km != null) partes.push(o.distancia_km < 1 ? `${Math.round(o.distancia_km * 1000)} m` : `${o.distancia_km.toFixed(1).replace(".", ",")} km`);
  if (o.dias_semana?.length) partes.push(o.dias_semana.map((d) => DIAS[d]).join(", "));
  partes.push(
    o.vigente_hasta
      ? `hasta ${new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(new Date(o.vigente_hasta)).replace(".", "")}`
      : "sin fecha"
  );
  return partes.join(" · ");
}

export default async function OfertasPage(props: PageProps<"/ofertas">) {
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
      <Top titulo="/Ofertas" volverA="/" />

      <h1 className="poster-2 break-words p-4">
        Ofertas <span className="sn-hot">cerca.</span>
      </h1>

      <div className="p-sec">
        <h2 className="sn-num">01 / De negocios</h2>
        <span className="sn-label">{conUbicacion ? `A menos de ${RADIO_KM} km` : "En tu zona"}</span>
      </div>
      {!conUbicacion ? <UsarUbicacion /> : null}

      {!ofertas.ok ? (
        <div className="px-4">
          <ErrorAviso>{ofertas.error}</ErrorAviso>
        </div>
      ) : ofertas.data.length === 0 ? (
        <div className="px-4">
          <EmptyState big="Sin ofertas" title="No hay ofertas cerca ahora" hint="Vuelve pronto: los negocios publican promociones cada semana." />
        </div>
      ) : (
        <div className="border-t-2 border-border">
          {ofertas.data.map((o, i) => (
            <Link key={o.oferta_id} href={`/negocio/${o.slug}`} className="p-row">
              <span
                className="sn-fig grid min-h-12 w-16 shrink-0 place-items-center border-2 border-ink px-1 text-center text-sm text-ink"
                style={{ background: FONDOS[i % FONDOS.length] }}
              >
                {descuento(o)}
              </span>
              <span className="p-row__t">
                <b className="break-words">{o.titulo}</b>
                <span className="sn-meta break-words">{meta(o)}</span>
              </span>
              <span className="p-row__r" aria-hidden>
                ↗
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="p-sec mt-4">
        <h2 className="sn-num">02 / Beneficios de marcas</h2>
        <span className="sn-label">Opcional</span>
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
                    <div className="sn-meta">{b.marca} · Marca aliada</div>
                    <div className="section mt-1 break-words">{b.titulo}</div>
                    {b.descripcion ? <p className="body-sm mt-1 break-words">{b.descripcion}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="sn-num mt-2 px-4">00 / Aún no hay beneficios disponibles</p>
            )
          ) : (
            <p className="sn-num mt-2 break-words px-4">
              00 / Activa la casilla para ver {marcas.data.total} {marcas.data.total === 1 ? "beneficio" : "beneficios"}
            </p>
          )}
        </>
      )}
    </Pantalla>
  );
}
