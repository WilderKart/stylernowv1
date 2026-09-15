import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VistaAgenda } from "./vista-agenda";

export const metadata = { title: "Agenda" };

export default async function AgendaPage(props: PageProps<"/panel/agenda">) {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/agenda");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const supabase = await createClient();
  const searchParams = await props.searchParams;
  const sedeParam = typeof searchParams.sede === "string" ? searchParams.sede : null;

  const { data: sedesNegocio } = await supabase
    .from("sede")
    .select("id, nombre, horario_base, zona_horaria")
    .eq("negocio_id", negocioId)
    .eq("cerrada_permanente", false)
    .order("es_principal", { ascending: false })
    .order("nombre");

  if (!sedesNegocio || sedesNegocio.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg">
        <PanelNav rol={contexto.rol} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 text-center sm:px-10">
          <p className="text-[12.5px] text-text-faint">Necesitás al menos una sede operativa para usar la Agenda.</p>
        </main>
      </div>
    );
  }

  const sedeActivaId =
    contexto.rol === "GUARDIAN"
      ? contexto.sedeId!
      : sedeParam && sedesNegocio.some((s) => s.id === sedeParam)
        ? sedeParam
        : sedesNegocio[0].id;
  const sedeActiva = sedesNegocio.find((s) => s.id === sedeActivaId)!;

  const { data: staff } = await supabase
    .from("vinculo_staff_negocio")
    .select("id, staff_id, staff:staff_id (nombre, foto_url)")
    .eq("negocio_id", negocioId)
    .eq("sede_activa_id", sedeActivaId)
    .eq("estado", "ACTIVO")
    .order("created_at");

  const staffSede = (staff ?? []).map((v) => ({
    vinculoId: v.id,
    staffId: v.staff_id,
    nombre: (v.staff as unknown as { nombre: string } | null)?.nombre ?? "Staff",
    fotoUrl: (v.staff as unknown as { foto_url: string | null } | null)?.foto_url ?? null,
  }));

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaAgenda
        negocioId={negocioId}
        sedes={contexto.rol === "BARBERIA" ? sedesNegocio.map((s) => ({ id: s.id, nombre: s.nombre })) : null}
        sede={{ id: sedeActiva.id, nombre: sedeActiva.nombre, horarioBase: sedeActiva.horario_base, zonaHoraria: sedeActiva.zona_horaria }}
        staff={staffSede}
      />
    </div>
  );
}
