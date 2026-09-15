import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { obtenerHistorialStaff } from "../actions";
import { DetalleStaff } from "./detalle-staff";

export const metadata = { title: "Detalle de Staff" };

export default async function StaffDetallePage(props: PageProps<"/panel/staff/[id]">) {
  const { id } = await props.params;
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect(`/login?next=/panel/staff/${id}`);
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const supabase = await createClient();

  // vista_staff_negocio hereda RLS real (security_invoker): a Guardian esta
  // consulta ya le devuelve NULL si el vínculo no es de su propia sede — el
  // notFound() de abajo es una segunda capa, no la única.
  const { data: staff } = await supabase
    .from("vista_staff_negocio")
    .select("*")
    .eq("vinculo_id", id)
    .maybeSingle();
  if (!staff) notFound();
  if (staff.negocio_id !== contexto.negocioId) notFound();

  const [{ data: otrasSedes }, resHistorial] = await Promise.all([
    contexto.permisos.trasladarStaff
      ? supabase
          .from("sede")
          .select("id, nombre")
          .eq("negocio_id", staff.negocio_id!)
          .neq("id", staff.sede_id ?? "")
          .eq("cerrada_permanente", false)
          .eq("cerrada_temporalmente", false)
      : Promise.resolve({ data: [] }),
    // El propio RLS de evento_auditoria ya limita esto a Barbería — se pide
    // igual para Guardian y llega vacío, sin exponer nada.
    obtenerHistorialStaff(id),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-16">
      <BarraSuperior titulo={staff.nombre!} volverA="/panel/staff" />
      <DetalleStaff
        staff={staff}
        permisos={contexto.permisos}
        otrasSedes={otrasSedes ?? []}
        historialInicial={resHistorial.ok ? resHistorial.data : []}
      />
    </div>
  );
}
