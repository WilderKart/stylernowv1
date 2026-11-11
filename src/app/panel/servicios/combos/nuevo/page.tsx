import { BarraSuperior } from "@/components/layout/header";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioNuevoCombo } from "./formulario-nuevo-combo";

export const metadata = { title: "Nuevo combo" };

export default async function NuevoComboPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/servicios/combos/nuevo");
  if (!contexto.permisos.gestionarCombos) redirect("/panel/servicios");

  const supabase = await createClient();
  const { data: servicios } = await supabase
    .from("servicio")
    .select("id, nombre, duracion_minutos, precio_base")
    .eq("negocio_id", contexto.negocioId!)
    .eq("estado", "ACTIVO")
    .order("nombre");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Nuevo combo" volverA="/panel/servicios" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        <FormularioNuevoCombo negocioId={contexto.negocioId!} servicios={servicios ?? []} />
      </main>
    </div>
  );
}
