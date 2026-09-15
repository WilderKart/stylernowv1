import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  listarResenas,
  obtenerIngresosPeriodo,
  obtenerRankingStaffPeriodo,
  obtenerServiciosTop,
} from "./actions";
import { VistaReportes } from "./vista-reportes";

export const metadata = { title: "Reportes" };

export default async function ReportesPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/reportes");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const sedeId = contexto.rol === "GUARDIAN" ? contexto.sedeId : null;
  const supabase = await createClient();

  const [sedesRes, ingresosRes, serviciosRes, rankingRes, resenasRes] = await Promise.all([
    contexto.rol === "BARBERIA"
      ? supabase.from("sede").select("id, nombre").eq("negocio_id", negocioId).eq("cerrada_permanente", false).order("nombre")
      : Promise.resolve({ data: null }),
    obtenerIngresosPeriodo({ negocioId, sedeId, agrupacion: "semana" }),
    obtenerServiciosTop(negocioId, sedeId),
    obtenerRankingStaffPeriodo({ negocioId, sedeId }),
    listarResenas(negocioId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaReportes
        negocioId={negocioId}
        sedeIdFijo={sedeId}
        sedes={sedesRes.data ?? null}
        ingresosIniciales={ingresosRes.ok ? ingresosRes.data : []}
        serviciosIniciales={serviciosRes.ok ? serviciosRes.data : []}
        rankingInicial={rankingRes.ok ? rankingRes.data : []}
        resenasIniciales={resenasRes.ok ? resenasRes.data : []}
      />
    </div>
  );
}
