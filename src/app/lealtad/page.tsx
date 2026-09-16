import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
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
    <div className="flex min-h-dvh flex-col bg-bg pb-24">
      <Header autenticado />
      <VistaLealtad
        resumenInicial={
          resumen.ok
            ? resumen.data
            : { walletSaldo: 0, movimientos: [], codigoReferido: null, referidos: [], sellos: [], cashback: [], familia: null, membresias: [] }
        }
        errorInicial={resumen.ok ? null : resumen.error}
      />
      <BottomNav />
    </div>
  );
}
