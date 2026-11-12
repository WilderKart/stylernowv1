import { BarraSuperior } from "@/components/layout/header";
import { Badge, Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("mem.meta") };
}

const DURACION_ETIQUETA = { 1: "mem.dur_1", 3: "mem.dur_3", 6: "mem.dur_6", 12: "mem.dur_12" } as const;

export default async function MembresiasNegocioPage(props: PageProps<"/negocio/[slug]/membresias">) {
  const { slug } = await props.params;
  const t = await obtenerT();
  const supabase = await createClient();

  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, nombre, slug")
    .eq("slug", slug)
    .eq("estado", "ACTIVO")
    .maybeSingle();
  if (!negocio) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: planes }, membresiaPropia] = await Promise.all([
    supabase
      .from("membresia_plan")
      .select("id, nombre, precio, duracion_meses, descuento_pct, servicio_ids, prioridad_reserva")
      .eq("negocio_id", negocio.id)
      .eq("activo", true)
      .order("precio"),
    user
      ? supabase
          .from("cliente_membresia")
          .select("id, estado")
          .eq("negocio_id", negocio.id)
          .eq("cliente_id", user.id)
          .in("estado", ["ACTIVA", "PROXIMA_A_VENCER", "SUSPENDIDA"])
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo={t("mem.meta")} volverA={`/negocio/${negocio.slug}`} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        <p className="mb-5 text-[12.5px] text-text-muted">{negocio.nombre}</p>

        {membresiaPropia.data ? (
          <Card className="mb-5 border-accent/40 bg-accent-soft">
            <p className="text-[12.5px] font-semibold text-accent-ink">
              {t("mem.ya_tienes", { estado: membresiaPropia.data.estado === "SUSPENDIDA" ? t("mem.congelada") : t("mem.activa") })}
            </p>
            <Link href={`/membresias/${membresiaPropia.data.id}`} className="mt-1 inline-block text-[12px] font-bold uppercase text-accent">
              {t("mem.ver_mia")}
            </Link>
          </Card>
        ) : null}

        {(planes ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            {t("mem.sin_planes")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {(planes ?? []).map((p) => (
              <Link key={p.id} href={`/negocio/${negocio.slug}/membresias/${p.id}`}>
                <Card className="transition-colors hover:border-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-bold text-text">{p.nombre}</p>
                      <p className="text-[11.5px] text-text-faint">{t("mem.facturacion", { dur: p.duracion_meses in DURACION_ETIQUETA ? t(DURACION_ETIQUETA[p.duracion_meses as keyof typeof DURACION_ETIQUETA]) : t("mem.dur_cada_n", { n: p.duracion_meses }) })}</p>
                    </div>
                    <p className="font-display shrink-0 text-[18px] font-bold text-accent">{formatCOP(Number(p.precio))}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.servicio_ids?.length ? (
                      <Badge tone="accent">{p.servicio_ids.length > 1 ? t("mem.n_servicios_incl", { n: p.servicio_ids.length }) : t("mem.n_servicio_incl", { n: p.servicio_ids.length })}</Badge>
                    ) : (
                      <Badge tone="accent">{t("mem.todos_incl")}</Badge>
                    )}
                    {Number(p.descuento_pct) > 0 ? <Badge tone="success">{t("mem.pct_desc", { n: p.descuento_pct })}</Badge> : null}
                    {p.prioridad_reserva ? <Badge>{t("mem.prioridad")}</Badge> : null}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
