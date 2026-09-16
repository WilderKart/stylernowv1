import { BarraSuperior } from "@/components/layout/header";
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
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Consultar Gift Card" volverA="/gift-cards" />
      <VistaConsultarGiftCard />
    </div>
  );
}
