import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resumenEliminacion } from "@/lib/cliente/cuenta";
import { VistaCuenta } from "./vista-cuenta";

export const metadata = {
  title: "Datos y cuenta",
  robots: { index: false, follow: false },
};

export default async function CuentaPage() {
  // Guard de sesión en el servidor (defensa en profundidad además del proxy).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");

  const r = await resumenEliminacion();
  return <VistaCuenta resumen={r.ok ? r.data : null} error={r.ok ? null : r.error} />;
}
