import { BarraSuperior } from "@/components/layout/header";
import { Badge, Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = { title: "Membresías" };

const DURACION_ETIQUETA: Record<number, string> = { 1: "mensual", 3: "trimestral", 6: "semestral", 12: "anual" };

export default async function MembresiasNegocioPage(props: PageProps<"/negocio/[slug]/membresias">) {
  const { slug } = await props.params;
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
      <BarraSuperior titulo="Membresías" volverA={`/negocio/${negocio.slug}`} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        <p className="mb-5 text-[12.5px] text-text-muted">{negocio.nombre}</p>

        {membresiaPropia.data ? (
          <Card className="mb-5 border-accent/40 bg-accent-soft">
            <p className="text-[12.5px] font-semibold text-accent-ink">
              Ya tenés una Membresía {membresiaPropia.data.estado === "SUSPENDIDA" ? "congelada" : "activa"} acá.
            </p>
            <Link href={`/membresias/${membresiaPropia.data.id}`} className="mt-1 inline-block text-[12px] font-bold uppercase text-accent">
              Ver mi Membresía →
            </Link>
          </Card>
        ) : null}

        {(planes ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Este Negocio todavía no tiene planes de Membresía disponibles.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {(planes ?? []).map((p) => (
              <Link key={p.id} href={`/negocio/${negocio.slug}/membresias/${p.id}`}>
                <Card className="transition-colors hover:border-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-bold text-text">{p.nombre}</p>
                      <p className="text-[11.5px] text-text-faint">Facturación {DURACION_ETIQUETA[p.duracion_meses] ?? `cada ${p.duracion_meses} meses`}</p>
                    </div>
                    <p className="font-display shrink-0 text-[18px] font-bold text-accent">{formatCOP(Number(p.precio))}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.servicio_ids?.length ? (
                      <Badge tone="accent">{p.servicio_ids.length} Servicio{p.servicio_ids.length > 1 ? "s" : ""} incluido{p.servicio_ids.length > 1 ? "s" : ""}</Badge>
                    ) : (
                      <Badge tone="accent">Todos los Servicios incluidos</Badge>
                    )}
                    {Number(p.descuento_pct) > 0 ? <Badge tone="success">{p.descuento_pct}% de descuento</Badge> : null}
                    {p.prioridad_reserva ? <Badge>Prioridad de reserva</Badge> : null}
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
