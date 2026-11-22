import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { listarInvitacionesPendientes, listarStaff } from "./actions";
import { ListaStaff, type AutorizacionStaff } from "./lista-staff";

export const metadata = { title: "Staff" };

const LIMITE_PAGINA = 20;

export default async function StaffListaPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/staff");

  const negocioId = contexto.negocioId!;
  const supabase = await createClient();

  const rpc = supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown }> };
  const [{ data: sedes }, resListado, resInvitaciones, { data: autorizaciones }] = await Promise.all([
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
    // Estado de autorizaciones del equipo: solo el dueño ve el de todos (la base lo decide).
    contexto.rol === "BARBERIA"
      ? rpc.rpc("estado_autorizaciones_staff", { p_negocio: negocioId })
      : Promise.resolve({ data: [] }),
  ]);
  const porStaff: Record<string, AutorizacionStaff> = {};
  for (const f of (autorizaciones ?? []) as Array<Record<string, unknown>>) {
    porStaff[f.staff_id as string] = {
      tieneFoto: Boolean(f.tiene_foto),
      tratamiento: (f.tratamiento as string | null) ?? null,
      publicacion: (f.publicacion as string | null) ?? null,
      publicable: Boolean(f.publicable),
      enTransicion: Boolean(f.en_transicion),
    };
  }

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
          autorizaciones={porStaff}
        />
      </main>
    </div>
  );
}
