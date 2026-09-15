import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioInvitacion } from "./formulario-invitacion";

export const metadata = { title: "Invitar Staff" };

export default async function InvitarStaffPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/staff/nuevo");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // Invitar Staff es exclusivo de Barbería (03-Business-Rules/01_Roles.md).
  if (!contexto.permisos.invitarStaff) redirect("/panel/staff");

  const supabase = await createClient();
  const { data: sedes } = await supabase
    .from("sede")
    .select("id, nombre")
    .eq("negocio_id", contexto.negocioId!)
    .eq("cerrada_permanente", false)
    .eq("cerrada_temporalmente", false)
    .order("es_principal", { ascending: false })
    .order("nombre");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Invitar Staff" volverA="/panel/staff" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        {!sedes || sedes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Necesitás al menos una sede operativa antes de invitar Staff.
          </p>
        ) : (
          <FormularioInvitacion negocioId={contexto.negocioId!} sedes={sedes} />
        )}
      </main>
    </div>
  );
}
