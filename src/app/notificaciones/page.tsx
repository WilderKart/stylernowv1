import { Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { BottomNav } from "@/components/layout/bottom-nav";
import { listarNotificaciones } from "@/lib/cliente/notificaciones";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ListaNotificaciones } from "./lista-notificaciones";
import { obtenerT } from "@/lib/i18n/servidor";
import { cargarClavesVapid } from "@/lib/notificaciones/web-push";
import { PreferenciasNotificaciones, type PreferenciaAviso } from "./preferencias-notificaciones";

type RpcSinTipos = {
  rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
};

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

  const [r, prefs] = await Promise.all([
    listarNotificaciones({ limite: 50 }),
    (supabase as unknown as RpcSinTipos).rpc("notif_preferencias_listar"),
  ]);
  // Solo la clave PÚBLICA llega al navegador, y solo si el par VAPID del servidor es coherente.
  const vapidPublica = cargarClavesVapid(process.env)?.publicaB64 ?? null;

  return (
    <Pantalla className="pb-24">
      <Top titulo={t("not.top")} volverA="/" />
      <ListaNotificaciones notificaciones={r.ok ? r.data : []} error={r.ok ? null : r.error} ahora={ahoraMs()} />
      {/* Sin la migración 124 aplicada la RPC falla y la sección simplemente no se muestra. */}
      {!prefs.error && Array.isArray(prefs.data) ? (
        <PreferenciasNotificaciones preferencias={prefs.data as PreferenciaAviso[]} vapidPublica={vapidPublica} />
      ) : null}
      <BottomNav />
    </Pantalla>
  );
}
