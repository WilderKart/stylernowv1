import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { obtenerCupoPlan, textoExcesoStaff, textoTopeStaff, topeStaffAlcanzado } from "@/lib/planes/cupo";
import { listarInvitacionesPendientes, listarStaff } from "./actions";
import { ListaStaff } from "./lista-staff";

export const metadata = { title: "Staff" };

const LIMITE_PAGINA = 20;

export default async function StaffListaPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "ADMIN", "GUARDIAN"], "/panel/staff");

  const negocioId = contexto.negocioId!;
  const esPropietario = contexto.rol === "BARBERIA";
  const supabase = await createClient();

  const cupo = contexto.permisos.invitarStaff ? await obtenerCupoPlan(negocioId) : null;
  const [{ data: sedes }, resListado, resInvitaciones] = await Promise.all([
    contexto.rol !== "GUARDIAN"
      ? supabase
          .from("sede")
          .select("id, nombre")
          .eq("negocio_id", negocioId)
          .eq("cerrada_permanente", false)
          .order("nombre")
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    listarStaff({ negocioId, sedeId: contexto.sedeId ?? undefined, limite: LIMITE_PAGINA }),
    contexto.permisos.invitarStaff ? listarInvitacionesPendientes(negocioId) : Promise.resolve({ ok: true as const, data: [] }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} prestaServicios={contexto.prestaServicios} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-10">
        <ListaStaff
          negocioId={negocioId}
          sedeIdFijo={contexto.rol === "GUARDIAN" ? contexto.sedeId : null}
          sedes={sedes ?? []}
          permisos={contexto.permisos}
          avisoCupo={cupo ? (textoExcesoStaff(cupo, { esPropietario }) ?? (topeStaffAlcanzado(cupo) ? textoTopeStaff(cupo, { esPropietario }) : null)) : null}
          puedeContratarAdicionales={esPropietario}
          resumenCupo={cupo ? `${cupo.staffUsado} de ${cupo.staffTope ?? "sin tope"} cupos de profesional ocupados` : null}
          itemsIniciales={resListado.ok ? resListado.data.items : []}
          totalInicial={resListado.ok ? resListado.data.total : 0}
          invitacionesIniciales={resInvitaciones.ok ? resInvitaciones.data : []}
          errorInicial={resListado.ok ? null : resListado.error}
        />
      </main>
    </div>
  );
}
