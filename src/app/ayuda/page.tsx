import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listarTickets } from "@/lib/cliente/soporte";
import { VistaAyuda } from "./vista-ayuda";

export const metadata = {
  title: "Ayuda y soporte",
  robots: { index: false, follow: false },
};

export default async function AyudaPage() {
  // Guard de sesión en el servidor (defensa en profundidad además del proxy).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ayuda");

  const r = await listarTickets();
  return <VistaAyuda tickets={r.ok ? r.data : []} errorTickets={r.ok ? null : r.error} />;
}
