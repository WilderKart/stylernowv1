import { Bloque, Fila, Filas, Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { Gift, Search, Ticket } from "lucide-react";
import { redirect } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("gc.meta") };
}

export default async function GiftCardsHubPage() {
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gift-cards");

  return (
    <Pantalla>
      <Top titulo={t("gc.top")} volverA="/lealtad" />
      <h1 className="poster-3 break-words px-4 pt-4">
        {t("gc.regala_1")} <span className="sn-hot">{t("gc.regala_2")}</span>
      </h1>
      <p className="body-sm break-words p-4">
        {t("gc.hub_txt")}
      </p>

      <Filas>
        <Fila
          icono={<Gift aria-hidden className="size-5" />}
          titulo={t("gc.comprar")}
          meta={t("gc.comprar_meta")}
          href="/gift-cards/comprar"
        />
        <Fila
          icono={<Ticket aria-hidden className="size-5" />}
          titulo={t("gc.mis")}
          meta={t("gc.mis_meta")}
          href="/gift-cards/mis"
        />
        <Fila
          icono={<Search aria-hidden className="size-5" />}
          titulo={t("gc.consultar")}
          meta={t("gc.consultar_meta")}
          href="/gift-cards/canjear"
        />
      </Filas>

      <Bloque etiqueta={t("gc.canje")}>
        {t("gc.canje_txt")}
      </Bloque>
    </Pantalla>
  );
}
