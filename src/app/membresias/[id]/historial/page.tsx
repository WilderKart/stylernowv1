import { BarraSuperior } from "@/components/layout/header";
import { Badge, Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Historial de Membresía" };

export default async function HistorialMembresiaPage(props: PageProps<"/membresias/[id]/historial">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/membresias/${id}/historial`);

  const { data: membresia } = await supabase.from("cliente_membresia").select("id, plan:plan_id (nombre)").eq("id", id).maybeSingle();
  if (!membresia) notFound();
  const plan = membresia.plan as unknown as { nombre: string } | null;

  const { data: usos } = await supabase
    .from("membresia_uso")
    .select("id, tipo, monto_beneficio, created_at, reserva:reserva_id (hora_inicio)")
    .eq("cliente_membresia_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Historial de uso" volverA={`/membresias/${id}`} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        <p className="mb-4 text-[12.5px] text-text-muted">{plan?.nombre}</p>
        {(usos ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Todavía no usaste ningún beneficio de esta Membresía.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(usos ?? []).map((u) => {
              const reserva = u.reserva as unknown as { hora_inicio: string } | null;
              return (
                <li key={u.id}>
                  <Card className="flex items-center justify-between">
                    <div>
                      <Badge tone={u.tipo === "SERVICIO_INCLUIDO" ? "accent" : "success"}>
                        {u.tipo === "SERVICIO_INCLUIDO" ? "Servicio incluido" : "Descuento aplicado"}
                      </Badge>
                      <p className="mt-1 text-[11.5px] text-text-faint">
                        {reserva ? new Date(reserva.hora_inicio).toLocaleDateString("es-CO") : new Date(u.created_at).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <p className="text-[13px] font-bold text-text">{formatCOP(Number(u.monto_beneficio))}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
