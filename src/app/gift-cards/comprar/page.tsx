import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioGiftCard } from "./formulario-gift-card";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("gc.comprar_meta_pag") };
}

export default async function ComprarGiftCardPage(props: PageProps<"/gift-cards/comprar">) {
  const searchParams = await props.searchParams;
  const t = await obtenerT();
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
    <Pantalla>
      <Top titulo={t("gc.comprar_top")} volverA="/gift-cards" />
      <FormularioGiftCard negocioPreseleccionado={negocioPreseleccionado} pagoIdRetorno={pagoIdRetorno} />
    </Pantalla>
  );
}
