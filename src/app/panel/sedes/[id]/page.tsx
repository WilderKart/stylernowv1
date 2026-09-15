import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { DetalleSede } from "./detalle-sede";

export const metadata = { title: "Detalle de sede" };

export default async function SedeDetallePage(props: PageProps<"/panel/sedes/[id]">) {
  const { id } = await props.params;
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect(`/login?next=/panel/sedes/${id}`);
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");

  const supabase = await createClient();

  const { data: sede } = await supabase
    .from("sede")
    .select(
      "id, negocio_id, nombre, direccion, ciudad, horario_base, latitud, longitud, es_principal, cerrada_temporalmente, cerrada_permanente"
    )
    .eq("id", id)
    .maybeSingle();
  if (!sede) notFound();
  if (sede.negocio_id !== contexto.negocioId) notFound();
  // Guardian (ADR-006): solo puede entrar al detalle de SU PROPIA sede —
  // ver la de otro compañero, aunque sea del mismo negocio, no es su alcance.
  if (contexto.rol === "GUARDIAN" && sede.id !== contexto.sedeId) notFound();

  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, nombre")
    .eq("id", sede.negocio_id)
    .single();
  if (!negocio) notFound();

  const [{ data: excepciones }, { data: staff }, { data: otrasSedes }] = await Promise.all([
    supabase
      .from("sede_horario_excepcion")
      .select("id, fecha, cerrado, hora_inicio_especial, hora_fin_especial, motivo")
      .eq("sede_id", id)
      .gte("fecha", new Date().toISOString().slice(0, 10))
      .order("fecha"),
    supabase.rpc("staff_de_sede", { p_sede_id: id }),
    contexto.permisos.trasladarStaff
      ? supabase
          .from("sede")
          .select("id, nombre")
          .eq("negocio_id", sede.negocio_id)
          .neq("id", id)
          .eq("cerrada_permanente", false)
          .eq("cerrada_temporalmente", false)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-16">
      <BarraSuperior
        titulo={sede.nombre}
        volverA={contexto.rol === "GUARDIAN" ? "/panel" : "/panel/sedes"}
      />
      <DetalleSede
        sede={sede}
        negocioId={negocio.id}
        permisos={contexto.permisos}
        excepcionesIniciales={excepciones ?? []}
        staffInicial={staff ?? []}
        otrasSedes={otrasSedes ?? []}
      />
    </div>
  );
}
