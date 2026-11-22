import { BarraSuperior } from "@/components/layout/header";
import { AvisoPlan } from "@/components/planes/aviso-plan";
import { obtenerCupoPlan, textoTopeStaff, topeStaffAlcanzado } from "@/lib/planes/cupo";
import { ROLES_ASIGNABLES, type RolAsignable } from "@/lib/auth/roles-equipo";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioInvitacion } from "./formulario-invitacion";

export const metadata = { title: "Invitar al equipo" };

export default async function InvitarStaffPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "ADMIN", "GUARDIAN"], "/panel/staff/nuevo");
  // Invitar es del propietario y del administrador delegado (03-Business-Rules/01_Roles.md + migración 161).
  if (!contexto.permisos.invitarStaff) redirect("/panel/staff");

  const supabase = await createClient();
  const cupo = await obtenerCupoPlan(contexto.negocioId!);
  const { data: sedes } = await supabase
    .from("sede")
    .select("id, nombre")
    .eq("negocio_id", contexto.negocioId!)
    .eq("cerrada_permanente", false)
    .eq("cerrada_temporalmente", false)
    .order("es_principal", { ascending: false })
    .order("nombre");

  // El servidor es la autoridad (crear_invitacion_staff): esto solo evita ofrecer lo que va a rechazar.
  //  · propietario: cualquier rol; administrador delegado: solo BARBER (no crea otros administradores).
  //  · con el cupo lleno solo quedan los roles que NO ocupan cupo (BUSINESS_ADMIN, y solo lo invita el propietario).
  const llenoDeCupo = cupo ? topeStaffAlcanzado(cupo) : false;
  const permitidos: RolAsignable[] =
    contexto.rol === "BARBERIA" ? [...ROLES_ASIGNABLES] : ["BARBER"];
  const rolesDisponibles = llenoDeCupo ? permitidos.filter((r) => r === "BUSINESS_ADMIN") : permitidos;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Invitar al equipo" volverA="/panel/staff" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        {cupo && llenoDeCupo ? (
          <div className="mb-4">
            <AvisoPlan
              titulo="Tu equipo ya está completo"
              detalle={`${textoTopeStaff(cupo, { esPropietario: contexto.rol === "BARBERIA" })}${rolesDisponibles.length > 0 ? " Aun así puedes invitar a un administrador que no atienda clientes: no ocupa cupo." : ""}`}
              accion={contexto.rol === "BARBERIA" ? "AGREGAR BARBEROS ADICIONALES" : "VOLVER A EQUIPO"}
              href={contexto.rol === "BARBERIA" ? "/panel/staff/adicionales" : "/panel/staff"}
            />
          </div>
        ) : null}
        {rolesDisponibles.length === 0 ? null : !sedes || sedes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Necesitas al menos una sede operativa antes de invitar al equipo.
          </p>
        ) : (
          <FormularioInvitacion
            negocioId={contexto.negocioId!}
            sedes={sedes}
            permiteComision={cupo?.comisiones ?? true}
            rolesDisponibles={rolesDisponibles}
          />
        )}
      </main>
    </div>
  );
}
