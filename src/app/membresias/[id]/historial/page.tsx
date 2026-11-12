import { Fila, Filas, Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import { obtenerIdioma, obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("mm.hist_meta") };
}

export default async function HistorialMembresiaPage(props: PageProps<"/membresias/[id]/historial">) {
  const { id } = await props.params;
  const t = await obtenerT();
  const loc = (await obtenerIdioma()) === "en" ? "en-US" : "es-CO";
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
    <Pantalla className="pb-10">
      <Top titulo={t("mm.historial_uso")} volverA={`/membresias/${id}`} />
      <h1 className="poster-4 break-words px-4 pt-4">{plan?.nombre}</h1>
      {(usos ?? []).length === 0 ? (
        <div className="p-4">
          <div className="sn-empty">
            <p className="section">{t("mm.hist_vacio")}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Filas>
            {(usos ?? []).map((u) => {
              const reserva = u.reserva as unknown as { hora_inicio: string } | null;
              return (
                <Fila
                  key={u.id}
                  titulo={reserva ? new Date(reserva.hora_inicio).toLocaleDateString(loc) : new Date(u.created_at).toLocaleDateString(loc)}
                  meta={
                    <Status tone={u.tipo === "SERVICIO_INCLUIDO" ? "info" : "ok"} className="self-start">
                      {u.tipo === "SERVICIO_INCLUIDO" ? t("mm.servicio_incl") : t("mm.descuento_aplicado")}
                    </Status>
                  }
                  derecha={<span className="sn-price">{formatCOP(Number(u.monto_beneficio))}</span>}
                />
              );
            })}
          </Filas>
        </div>
      )}
    </Pantalla>
  );
}
