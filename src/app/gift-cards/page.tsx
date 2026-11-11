import { Bloque, Fila, Filas, Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { createClient } from "@/lib/supabase/server";
import { Gift, Search, Ticket } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = { title: "Gift Cards" };

export default async function GiftCardsHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gift-cards");

  return (
    <Pantalla>
      <Top titulo="03 / Gift cards" volverA="/lealtad" />
      <h1 className="poster-3 break-words px-4 pt-4">
        Regala <span className="sn-hot">estilo.</span>
      </h1>
      <p className="body-sm break-words p-4">
        Regala una gift card digital para tu barbería favorita: para ti, para otra persona o por lote para tu empresa.
      </p>

      <Filas>
        <Fila
          icono={<Gift aria-hidden className="size-5" />}
          titulo="Comprar una gift card"
          meta="Elige el monto, para quién es y paga en segundos."
          href="/gift-cards/comprar"
        />
        <Fila
          icono={<Ticket aria-hidden className="size-5" />}
          titulo="Mis gift cards"
          meta="Las que compraste y las que te regalaron."
          href="/gift-cards/mis"
        />
        <Fila
          icono={<Search aria-hidden className="size-5" />}
          titulo="Consultar una gift card"
          meta="Verifica el saldo antes de presentarla en el local."
          href="/gift-cards/canjear"
        />
      </Filas>

      <Bloque etiqueta="00 / Canje">
        El canje de una gift card se hace únicamente en el local, cuando el staff la registra en el momento de tu visita. Por
        seguridad, no se puede canjear a distancia.
      </Bloque>
    </Pantalla>
  );
}
