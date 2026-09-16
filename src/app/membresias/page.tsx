import { BarraSuperior } from "@/components/layout/header";
import { Badge, Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Mis Membresías" };

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  ACTIVA: "success",
  PROXIMA_A_VENCER: "accent",
  SUSPENDIDA: "neutral",
  CANCELADA: "danger",
  VENCIDA: "danger",
};
const ESTADO_ETIQUETA: Record<string, string> = {
  ACTIVA: "Activa",
  PROXIMA_A_VENCER: "Próxima a vencer",
  SUSPENDIDA: "Congelada",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencida",
};

export default async function MisMembresiasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/membresias");

  const { data: membresias } = await supabase
    .from("cliente_membresia")
    .select("id, estado, fecha_proximo_cobro, plan:plan_id (nombre, precio), negocio:negocio_id (nombre, slug)")
    .eq("cliente_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Mis Membresías" volverA="/perfil" />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        {(membresias ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Todavía no tenés ninguna Membresía. Buscá tu Barbería favorita y mirá sus planes.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {(membresias ?? []).map((m) => {
              const plan = m.plan as unknown as { nombre: string; precio: number } | null;
              const negocio = m.negocio as unknown as { nombre: string; slug: string } | null;
              return (
                <Link key={m.id} href={`/membresias/${m.id}`}>
                  <Card className="transition-colors hover:border-accent/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">{negocio?.nombre}</p>
                        <p className="mt-0.5 text-[14.5px] font-bold text-text">{plan?.nombre}</p>
                      </div>
                      <Badge tone={ESTADO_TONO[m.estado] ?? "neutral"}>{ESTADO_ETIQUETA[m.estado] ?? m.estado}</Badge>
                    </div>
                    <p className="mt-2 text-[12px] text-text-muted">
                      {formatCOP(Number(plan?.precio ?? 0))} · próximo cobro {new Date(m.fecha_proximo_cobro).toLocaleDateString("es-CO")}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
