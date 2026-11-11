import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { BottomNav } from "@/components/layout/bottom-nav";
import { listarNotificaciones } from "@/lib/cliente/notificaciones";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ListaNotificaciones } from "./lista-notificaciones";

export const metadata = {
  title: "Avisos",
  robots: { index: false, follow: false },
};

/** Momento del render en el servidor, para agrupar por día. */
function ahoraMs() {
  return Date.now();
}

export default async function NotificacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notificaciones");

  const r = await listarNotificaciones({ limite: 50 });

  return (
    <Pantalla className="pb-24">
      <Top titulo="/Notificaciones" volverA="/" />
      <ListaNotificaciones notificaciones={r.ok ? r.data : []} error={r.ok ? null : r.error} ahora={ahoraMs()} />
      <BottomNav />
    </Pantalla>
  );
}
