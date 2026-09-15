import { BarraSuperior } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { DetalleSede } from "./detalle-sede";

export const metadata = { title: "Detalle de sede" };

export default async function SedeDetallePage(props: PageProps<"/panel/sedes/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/panel/sedes/${id}`);

  const { data: sede } = await supabase
    .from("sede")
    .select(
      "id, negocio_id, nombre, direccion, ciudad, horario_base, latitud, longitud, es_principal, cerrada_temporalmente, cerrada_permanente"
    )
    .eq("id", id)
    .maybeSingle();
  if (!sede) notFound();

  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, owner_user_id, nombre")
    .eq("id", sede.negocio_id)
    .single();
  if (!negocio || negocio.owner_user_id !== user.id) notFound();

  const [{ data: excepciones }, { data: staff }, { data: otrasSedes }] = await Promise.all([
    supabase
      .from("sede_horario_excepcion")
      .select("id, fecha, cerrado, hora_inicio_especial, hora_fin_especial, motivo")
      .eq("sede_id", id)
      .gte("fecha", new Date().toISOString().slice(0, 10))
      .order("fecha"),
    supabase.rpc("staff_de_sede", { p_sede_id: id }),
    supabase
      .from("sede")
      .select("id, nombre")
      .eq("negocio_id", sede.negocio_id)
      .neq("id", id)
      .eq("cerrada_permanente", false)
      .eq("cerrada_temporalmente", false),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-16">
      <BarraSuperior titulo={sede.nombre} volverA="/panel/sedes" />
      <DetalleSede
        sede={sede}
        negocioId={negocio.id}
        excepcionesIniciales={excepciones ?? []}
        staffInicial={staff ?? []}
        otrasSedes={otrasSedes ?? []}
      />
    </div>
  );
}
