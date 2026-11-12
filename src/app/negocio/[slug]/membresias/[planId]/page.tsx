import { BarraSuperior } from "@/components/layout/header";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("mem.detalle_meta") };
}

const DURACION_ETIQUETA = { 1: "mem.d_1", 3: "mem.d_3", 6: "mem.d_6", 12: "mem.d_12" } as const;

export default async function DetalleMembresiaNegocioPage(props: PageProps<"/negocio/[slug]/membresias/[planId]">) {
  const { slug, planId } = await props.params;
  const t = await obtenerT();
  const supabase = await createClient();

  const { data: negocio } = await supabase.from("negocio").select("id, nombre, slug").eq("slug", slug).eq("estado", "ACTIVO").maybeSingle();
  if (!negocio) notFound();

  const { data: plan } = await supabase
    .from("membresia_plan")
    .select("*, servicios:servicio_ids")
    .eq("id", planId)
    .eq("negocio_id", negocio.id)
    .eq("activo", true)
    .maybeSingle();
  if (!plan) notFound();

  const { data: serviciosIncluidos } = plan.servicio_ids?.length
    ? await supabase.from("servicio").select("id, nombre").in("id", plan.servicio_ids)
    : { data: [] };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membresiaPropia } = user
    ? await supabase
        .from("cliente_membresia")
        .select("id, estado")
        .eq("negocio_id", negocio.id)
        .eq("cliente_id", user.id)
        .in("estado", ["ACTIVA", "PROXIMA_A_VENCER", "SUSPENDIDA"])
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-28">
      <BarraSuperior titulo={plan.nombre} volverA={`/negocio/${negocio.slug}/membresias`} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        <Card>
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">{negocio.nombre}</p>
          <p className="font-display mt-1 text-[24px] font-bold text-accent">
            {formatCOP(Number(plan.precio))}
            <span className="text-[13px] font-normal text-text-faint"> {plan.duracion_meses in DURACION_ETIQUETA ? t(DURACION_ETIQUETA[plan.duracion_meses as keyof typeof DURACION_ETIQUETA]) : t("mem.dur_cada_n", { n: plan.duracion_meses })}</span>
          </p>
        </Card>

        <section className="mt-5">
          <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-text-faint">{t("mem.beneficios")}</h2>
          <ul className="flex flex-col gap-2">
            {(serviciosIncluidos ?? []).length > 0 ? (
              (serviciosIncluidos ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[13px] text-text">
                  <Badge tone="accent">{t("mem.incluido")}</Badge> {s.nombre}
                </li>
              ))
            ) : (
              <li className="flex items-center gap-2 text-[13px] text-text">
                <Badge tone="accent">{t("mem.incluido")}</Badge> {t("mem.todos_de", { nombre: negocio.nombre })}
              </li>
            )}
            {Number(plan.descuento_pct) > 0 ? (
              <li className="flex items-center gap-2 text-[13px] text-text">
                <Badge tone="success">{t("mem.descuento")}</Badge> {t("mem.desc_resto", { n: plan.descuento_pct })}
              </li>
            ) : null}
            {plan.limite_usos_mes ? (
              <li className="text-[12.5px] text-text-muted">{t("mem.hasta_usos", { n: plan.limite_usos_mes })}</li>
            ) : (
              <li className="text-[12.5px] text-text-muted">{t("mem.sin_limite")}</li>
            )}
            {plan.prioridad_reserva ? <li className="text-[12.5px] text-text-muted">{t("mem.prioridad_turno")}</li> : null}
            {plan.regalo_cumpleanos ? <li className="text-[12.5px] text-text-muted">{t("mem.regalo_cumple", { regalo: plan.regalo_cumpleanos })}</li> : null}
            {plan.congelacion_max_dias > 0 ? (
              <li className="text-[12.5px] text-text-muted">{t("mem.congelar", { n: plan.congelacion_max_dias })}</li>
            ) : null}
          </ul>
        </section>

        {membresiaPropia ? (
          <p className="mt-6 rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-3 text-center text-[12.5px] text-text-muted">
            {t("mem.ya_tienes_negocio", { estado: membresiaPropia.estado === "SUSPENDIDA" ? t("mem.congelada") : t("mem.activa") })}{" "}
            <Link href={`/membresias/${membresiaPropia.id}`} className="font-bold text-accent">{t("mem.verla")}</Link>
          </p>
        ) : null}
      </main>

      {!membresiaPropia ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto w-full max-w-md">
            <Link href={`/checkout/membresia/${plan.id}`}>
              <Button size="lg" className="w-full">{t("mem.comprar_por", { monto: formatCOP(Number(plan.precio)) })}</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
