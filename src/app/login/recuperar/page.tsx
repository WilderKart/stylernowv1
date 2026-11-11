import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Hot, PantallaAuth } from "../_componentes/pantalla-auth";
import { VistaRecuperar } from "./vista-recuperar";

export const metadata = { title: "Recuperar contraseña" };

/**
 * Destino de `solicitarRecuperacion()` (vía `/auth/callback`). Requiere la
 * sesión temporal que Supabase ya estableció con el link de recuperación —
 * nunca acepta un token propio del cliente ni la contraseña vieja.
 */
export default async function RecuperarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <PantallaAuth
      indice="07 / Recuperar"
      volver="/login"
      titulo={
        <>
          Nueva
          <br />
          <Hot>contraseña.</Hot>
        </>
      }
      intro="Elegí una contraseña nueva para tu cuenta."
    >
      <VistaRecuperar />
    </PantallaAuth>
  );
}
