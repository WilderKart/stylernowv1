import { BarraSuperior } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioGiftCard } from "./formulario-gift-card";

export const metadata = { title: "Comprar Gift Card" };

export default async function ComprarGiftCardPage(props: PageProps<"/gift-cards/comprar">) {
  const searchParams = await props.searchParams;
  const negocioSlug = typeof searchParams.negocio === "string" ? searchParams.negocio : null;
  const pagoIdRetorno = typeof searchParams.pagoId === "string" ? searchParams.pagoId : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/gift-cards/comprar${negocioSlug ? `?negocio=${negocioSlug}` : ""}`);

  const { data: negocioPreseleccionado } = negocioSlug
    ? await supabase.from("negocio").select("id, nombre, slug").eq("slug", negocioSlug).eq("estado", "ACTIVO").maybeSingle()
    : { data: null };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Comprar Gift Card" volverA="/gift-cards" />
      <FormularioGiftCard negocioPreseleccionado={negocioPreseleccionado} pagoIdRetorno={pagoIdRetorno} />
    </div>
  );
}
