import { PanelNav } from "@/components/panel/panel-nav";
import { Badge, Card } from "@/components/ui/card";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Sedes" };

export default async function SedesPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/sedes");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // Guardian no gestiona una lista de sedes ajenas — administra la propia
  // desde su Resumen (ADR-006). Esta pantalla es exclusiva de Barbería.
  if (contexto.rol === "GUARDIAN") redirect(`/panel/sedes/${contexto.sedeId}`);
  // Staff plano no administra sedes en absoluto (03-Business-Rules/01_Roles.md).
  if (contexto.rol === "STAFF") redirect("/panel");

  const supabase = await createClient();
  const negocioId = contexto.negocioId!;

  const { data: negocio } = await supabase
    .from("negocio")
    .select("plan_codigo")
    .eq("id", negocioId)
    .single();
  if (!negocio) redirect("/panel/onboarding");

  const [{ data: sedes }, { data: plan }] = await Promise.all([
    supabase
      .from("sede")
      .select("id, nombre, direccion, ciudad, es_principal, cerrada_temporalmente, cerrada_permanente")
      .eq("negocio_id", negocioId)
      .order("es_principal", { ascending: false })
      .order("created_at"),
    supabase.from("plan").select("limite_sedes").eq("codigo", negocio.plan_codigo).single(),
  ]);

  const sedesOperativas = (sedes ?? []).filter((s) => !s.cerrada_permanente);
  const limiteAlcanzado = plan?.limite_sedes != null && sedesOperativas.length >= plan.limite_sedes;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[22px] font-bold uppercase text-text">Sedes</h1>
            <p className="mt-1 text-[12.5px] text-text-muted">
              {sedesOperativas.length} de {plan?.limite_sedes ?? "∞"} sedes de tu plan{" "}
              {negocio.plan_codigo}
            </p>
          </div>
          {limiteAlcanzado ? (
            <span className="rounded-full border border-border px-4 py-2.5 text-[12px] font-semibold text-text-faint">
              Límite del plan alcanzado
            </span>
          ) : (
            <Link
              href="/panel/sedes/nueva"
              className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-[12.5px] font-bold text-bg hover:bg-accent-hover"
            >
              + NUEVA SEDE
            </Link>
          )}
        </div>

        {!sedes || sedes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Todavía no tenés ninguna sede.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sedes.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/panel/sedes/${s.id}`}
                  className="block rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:border-accent/40"
                >
                  <Card className="border-none bg-transparent p-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[14.5px] font-bold text-text">{s.nombre}</p>
                          {s.es_principal ? <Badge tone="accent">PRINCIPAL</Badge> : null}
                        </div>
                        <p className="mt-1 truncate text-[12.5px] text-text-faint">
                          {s.direccion} · {s.ciudad}
                        </p>
                      </div>
                      {s.cerrada_permanente ? (
                        <Badge tone="danger">ELIMINADA</Badge>
                      ) : s.cerrada_temporalmente ? (
                        <Badge tone="danger">CERRADA</Badge>
                      ) : (
                        <Badge tone="success">OPERATIVA</Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
