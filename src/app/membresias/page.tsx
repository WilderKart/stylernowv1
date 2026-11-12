import { ErrorAviso, Pantalla, TicketCita, Top } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import { redirect } from "next/navigation";
import { obtenerIdioma, obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("mm.meta") };
}

const ESTADO_TONO: Record<string, "ok" | "warn" | "err" | "info"> = {
  ACTIVA: "ok",
  PROXIMA_A_VENCER: "warn",
  SUSPENDIDA: "info",
  CANCELADA: "err",
  VENCIDA: "err",
};
const ESTADO_ETIQUETA = {
  ACTIVA: "mm.est_activa",
  PROXIMA_A_VENCER: "mm.est_proxima",
  SUSPENDIDA: "mm.est_suspendida",
  CANCELADA: "mm.est_cancelada",
  VENCIDA: "mm.est_vencida",
} as const;

export default async function MisMembresiasPage() {
  const t = await obtenerT();
  const loc = (await obtenerIdioma()) === "en" ? "en-US" : "es-CO";
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
      <Top titulo={t("mm.top")} volverA="/perfil" />
      <div className="flex flex-col gap-4 p-4">
        {error ? <ErrorAviso>{t("mm.err")}</ErrorAviso> : null}
        {(membresias ?? []).length === 0 && !error ? (
          <div className="sn-empty">
            <p className="section">{t("mm.ninguna")}</p>
            <p className="sn-meta">{t("mm.busca")}</p>
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
                    dia={cobro.toLocaleDateString(loc, { day: "2-digit" })}
                    mes={cobro.toLocaleDateString(loc, { month: "short" }).replace(".", "")}
                    estado={<Status tone={ESTADO_TONO[m.estado] ?? "info"}>{ESTADO_ETIQUETA[m.estado as keyof typeof ESTADO_ETIQUETA] ? t(ESTADO_ETIQUETA[m.estado as keyof typeof ESTADO_ETIQUETA]) : m.estado}</Status>}
                    titulo={plan?.nombre ?? t("mm.membresia")}
                    lineas={[negocio?.nombre ?? "", t("mm.proximo_cobro", { monto: formatCOP(Number(plan?.precio ?? 0)) })]}
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
