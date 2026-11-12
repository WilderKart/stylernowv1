import { BarraSuperior } from "@/components/layout/header";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { obtenerCierreCaja } from "../actions";
import { VistaCierreCaja } from "./vista-cierre-caja";

export const metadata = { title: "Cierre de caja" };

export default async function CierreCajaPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/pos/caja");

  const negocioId = contexto.negocioId!;
  const sedeId = contexto.rol === "GUARDIAN" ? contexto.sedeId : null;
  const res = await obtenerCierreCaja(negocioId, sedeId);

  // Sedes para registrar egresos de caja menor (un guardián solo ve la suya).
  const supabase = await createClient();
  const { data: sedesData } = await supabase
    .from("sede")
    .select("id, nombre")
    .eq("negocio_id", negocioId)
    .eq("cerrada_permanente", false)
    .order("created_at");
  const sedes = (sedesData ?? []).filter((s) => sedeId === null || s.id === sedeId);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Cierre de caja" volverA="/panel/pos" />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-10">
        <VistaCierreCaja
          negocioId={negocioId}
          sedeId={sedeId}
          sedes={sedes}
          cierreInicial={res.ok ? res.data : null}
          errorInicial={res.ok ? null : res.error}
        />
      </main>
    </div>
  );
}
