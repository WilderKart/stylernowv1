import { BottomNav } from "@/components/layout/bottom-nav";
import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerResumenLealtad } from "./actions";
import { VistaLealtad } from "./vista-lealtad";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("ll.meta") };
}

export default async function LealtadPage() {
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/lealtad");

  const resumen = await obtenerResumenLealtad();

  return (
    <Pantalla className="pb-24">
      <Top titulo={t("ll.top")} volverA="/perfil" />
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
