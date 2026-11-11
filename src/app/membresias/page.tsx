import { ErrorAviso, Pantalla, TicketCita, Top } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata = { title: "Mis Membresías" };

const ESTADO_TONO: Record<string, "ok" | "warn" | "err" | "info"> = {
  ACTIVA: "ok",
  PROXIMA_A_VENCER: "warn",
  SUSPENDIDA: "info",
  CANCELADA: "err",
  VENCIDA: "err",
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

  const { data: membresias, error } = await supabase
    .from("cliente_membresia")
    .select("id, estado, fecha_proximo_cobro, plan:plan_id (nombre, precio), negocio:negocio_id (nombre, slug)")
    .eq("cliente_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <Pantalla className="pb-10">
      <Top titulo="Mis membresías" volverA="/perfil" />
      <div className="flex flex-col gap-4 p-4">
        {error ? <ErrorAviso>No pudimos cargar tus membresías. Intenta de nuevo.</ErrorAviso> : null}
        {(membresias ?? []).length === 0 && !error ? (
          <div className="sn-empty">
            <p className="section">Aún no tienes ninguna membresía.</p>
            <p className="sn-meta">Busca tu barbería favorita y mira sus planes.</p>
          </div>
        ) : (
          <ul className="p-stack">
            {(membresias ?? []).map((m) => {
              const plan = m.plan as unknown as { nombre: string; precio: number } | null;
              const negocio = m.negocio as unknown as { nombre: string; slug: string } | null;
              const cobro = new Date(m.fecha_proximo_cobro);
              return (
                <li key={m.id}>
                  <TicketCita
                    href={`/membresias/${m.id}`}
                    dia={cobro.toLocaleDateString("es-CO", { day: "2-digit" })}
                    mes={cobro.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                    estado={<Status tone={ESTADO_TONO[m.estado] ?? "info"}>{ESTADO_ETIQUETA[m.estado] ?? m.estado}</Status>}
                    titulo={plan?.nombre ?? "Membresía"}
                    lineas={[negocio?.nombre ?? "", `${formatCOP(Number(plan?.precio ?? 0))} · próximo cobro`]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Pantalla>
  );
}
