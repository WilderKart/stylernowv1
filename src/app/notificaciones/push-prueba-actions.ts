"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * «Enviar una prueba» del aviso push al PROPIO usuario. La identidad sale de la sesión; el navegador no elige a quién se envía.
 * La prueba viaja por el mismo camino que cualquier aviso real (se encola en el outbox y la base despierta al servidor que la
 * envía), así que si llega, el recorrido completo funciona. Solo llega a las suscripciones de quien pulsa el botón y se limita a
 * una cada 20 s por usuario.
 */
type Res = { ok: true } | { ok: false; error: string };

const ultimoEnvio = new Map<string, number>();
const ESPERA_MS = 20_000;

export async function enviarPushPruebaAction(): Promise<Res> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión para continuar." };

  const ahora = Date.now();
  if (ahora - (ultimoEnvio.get(user.id) ?? 0) < ESPERA_MS) return { ok: false, error: "Espera unos segundos antes de enviar otra prueba." };
  ultimoEnvio.set(user.id, ahora);

  const admin = createAdminClient() as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: unknown }> };
  const { data, error } = await admin.rpc("_notif_encolar_canales", {
    p_evento: "AVISO_PRUEBA",
    p_usuario: user.id,
    p_negocio: null,
    p_datos: { ruta: "/notificaciones" },
    p_clave: `prueba:${user.id}:${ahora}`,
    p_canales: ["PUSH"],
  });
  if (error) return { ok: false, error: "No pudimos enviar la prueba. Inténtalo de nuevo." };
  // 0 = la base no encoló nada: este usuario no tiene ningún dispositivo registrado (o apagó este aviso).
  return Number(data) > 0 ? { ok: true } : { ok: false, error: "Este dispositivo todavía no está registrado. Activa los avisos primero." };
}
