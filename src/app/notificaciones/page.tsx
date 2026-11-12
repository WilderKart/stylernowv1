import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { BottomNav } from "@/components/layout/bottom-nav";
import { listarNotificaciones } from "@/lib/cliente/notificaciones";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ListaNotificaciones } from "./lista-notificaciones";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("not.meta"), robots: { index: false, follow: false } };
}

/** Momento del render en el servidor, para agrupar por día. */
function ahoraMs() {
  return Date.now();
}

export default async function NotificacionesPage() {
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notificaciones");

  const r = await listarNotificaciones({ limite: 50 });

  return (
    <Pantalla className="pb-24">
      <Top titulo={t("not.top")} volverA="/" />
      <ListaNotificaciones notificaciones={r.ok ? r.data : []} error={r.ok ? null : r.error} ahora={ahoraMs()} />
      <BottomNav />
    </Pantalla>
  );
}
