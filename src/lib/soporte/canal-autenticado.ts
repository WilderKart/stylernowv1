import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Abre un canal de Realtime YA autenticado con la sesión. Si el canal se suscribe antes de que Realtime tenga el token, la
 * base lo trata como anónimo: la RLS rechaza los eventos (401) y las suscripciones con filtro fallan. Devuelve la función que
 * lo cierra (segura de llamar aunque el canal aún no se haya abierto).
 */
export function abrirCanalAutenticado(supabase: SupabaseClient, crear: () => RealtimeChannel): () => void {
  let cancelado = false;
  let canal: RealtimeChannel | null = null;
  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (cancelado) return;
    if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
    if (cancelado) return;
    canal = crear();
  })();
  return () => {
    cancelado = true;
    if (canal) void supabase.removeChannel(canal);
  };
}
