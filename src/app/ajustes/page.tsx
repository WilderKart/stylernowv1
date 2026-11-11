import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** /ajustes no tiene pantalla propia: lleva al primer paso (idioma y región). */
export default async function AjustesPage() {
  // Guard de sesión en el servidor (defensa en profundidad además del proxy).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ajustes/idioma-region");
  redirect("/ajustes/idioma-region");
}
