import { Fila, Filas, Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
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
    <Pantalla className="pb-10">
      <Top titulo="Historial de uso" volverA={`/membresias/${id}`} />
      <h1 className="poster-4 break-words px-4 pt-4">{plan?.nombre}</h1>
      {(usos ?? []).length === 0 ? (
        <div className="p-4">
          <div className="sn-empty">
            <p className="section">Aún no usas ningún beneficio de esta membresía.</p>
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
                  titulo={reserva ? new Date(reserva.hora_inicio).toLocaleDateString("es-CO") : new Date(u.created_at).toLocaleDateString("es-CO")}
                  meta={
                    <Status tone={u.tipo === "SERVICIO_INCLUIDO" ? "info" : "ok"} className="self-start">
                      {u.tipo === "SERVICIO_INCLUIDO" ? "Servicio incluido" : "Descuento aplicado"}
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
