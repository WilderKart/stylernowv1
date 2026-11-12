import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VistaConsultarGiftCard } from "./vista-consultar";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("gc.consultar_meta_pag") };
}

export default async function CanjearGiftCardPage() {
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gift-cards/canjear");

  return (
    <Pantalla>
      <Top titulo={t("gc.consultar_top")} volverA="/gift-cards" />
      <VistaConsultarGiftCard />
    </Pantalla>
  );
}
