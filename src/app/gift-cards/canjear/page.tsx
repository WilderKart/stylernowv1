import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VistaConsultarGiftCard } from "./vista-consultar";

export const metadata = { title: "Consultar Gift Card" };

export default async function CanjearGiftCardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gift-cards/canjear");

  return (
    <Pantalla>
      <Top titulo="Consultar gift card" volverA="/gift-cards" />
      <VistaConsultarGiftCard />
    </Pantalla>
  );
}
