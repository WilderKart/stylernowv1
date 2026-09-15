import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listarInvitacionesPendientes, listarStaff } from "./actions";
import { ListaStaff } from "./lista-staff";

export const metadata = { title: "Staff" };

const LIMITE_PAGINA = 20;

export default async function StaffListaPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/staff");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // Staff plano no administra el equipo — ve su propia ficha cuando exista
  // la App Staff (Fase 4), no esta pantalla.
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const supabase = await createClient();

  const [{ data: sedes }, resListado, resInvitaciones] = await Promise.all([
    contexto.rol === "BARBERIA"
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
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-10">
        <ListaStaff
          negocioId={negocioId}
          sedeIdFijo={contexto.rol === "GUARDIAN" ? contexto.sedeId : null}
          sedes={sedes ?? []}
          permisos={contexto.permisos}
          itemsIniciales={resListado.ok ? resListado.data.items : []}
          totalInicial={resListado.ok ? resListado.data.total : 0}
          invitacionesIniciales={resInvitaciones.ok ? resInvitaciones.data : []}
          errorInicial={resListado.ok ? null : resListado.error}
        />
      </main>
    </div>
  );
}
