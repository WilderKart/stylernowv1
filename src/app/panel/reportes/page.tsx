import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import {
  listarResenas,
  obtenerHorariosMuertos,
  obtenerIngresosPeriodo,
  obtenerMiPosicionMarketplace,
  obtenerRankingStaffPeriodo,
  obtenerServiciosTop,
} from "./actions";
import { VistaReportes } from "./vista-reportes";

export const metadata = { title: "Reportes" };

export default async function ReportesPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/reportes");

  const negocioId = contexto.negocioId!;
  const sedeId = contexto.rol === "GUARDIAN" ? contexto.sedeId : null;
  const supabase = await createClient();

  const [sedesRes, ingresosRes, serviciosRes, rankingRes, resenasRes, posicionRes, horariosMuertosRes] = await Promise.all([
    contexto.rol === "BARBERIA"
      ? supabase.from("sede").select("id, nombre").eq("negocio_id", negocioId).eq("cerrada_permanente", false).order("nombre")
      : Promise.resolve({ data: null }),
    obtenerIngresosPeriodo({ negocioId, sedeId, agrupacion: "semana" }),
    obtenerServiciosTop(negocioId, sedeId),
    obtenerRankingStaffPeriodo({ negocioId, sedeId }),
    listarResenas(negocioId),
    // marketplace_mi_posicion() exige ser la Barbería dueña — Guardian no
    // tiene alcance sobre esto (03-Business-Rules/01_Roles.md, Permisos).
    contexto.rol === "BARBERIA" ? obtenerMiPosicionMarketplace(negocioId) : Promise.resolve({ ok: false as const, error: "" }),
    obtenerHorariosMuertos(negocioId),
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
        posicionMarketplace={posicionRes.ok ? posicionRes.data : null}
        horariosMuertos={horariosMuertosRes.ok ? horariosMuertosRes.data : []}
      />
    </div>
  );
}
