import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";
import { Hot, PantallaAuth } from "../_componentes/pantalla-auth";
import { VistaRecuperar } from "./vista-recuperar";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("login.meta_recuperar") };
}

/**
 * Destino de `solicitarRecuperacion()` (vía `/auth/callback`). Requiere la
 * sesión temporal que Supabase ya estableció con el link de recuperación —
 * nunca acepta un token propio del cliente ni la contraseña vieja.
 */
export default async function RecuperarPage() {
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <PantallaAuth
      indice={t("login.i_recuperar7")}
      volver="/login"
      titulo={
        <>
          {t("login.t_nueva_1")}
          <br />
          <Hot>{t("login.t_nueva_2")}</Hot>
        </>
      }
      intro={t("login.intro_nueva")}
    >
      <VistaRecuperar />
    </PantallaAuth>
  );
}
