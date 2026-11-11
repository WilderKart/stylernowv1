import { BottomNav } from "@/components/layout/bottom-nav";
import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerResumenLealtad } from "./actions";
import { VistaLealtad } from "./vista-lealtad";

export const metadata = { title: "Mi Lealtad" };

export default async function LealtadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/lealtad");

  const resumen = await obtenerResumenLealtad();

  return (
    <Pantalla className="pb-24">
      <Top titulo="Mi lealtad" volverA="/perfil" />
      <VistaLealtad
        resumenInicial={
          resumen.ok
            ? resumen.data
            : { walletSaldo: 0, movimientos: [], codigoReferido: null, referidos: [], sellos: [], cashback: [], familia: null, membresias: [] }
        }
        errorInicial={resumen.ok ? null : resumen.error}
      />
      <BottomNav />
    </Pantalla>
  );
}
