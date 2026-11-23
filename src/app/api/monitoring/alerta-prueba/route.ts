import { createClient } from "@/lib/supabase/server";
import { limitar } from "@/lib/rate-limit";
import { enviarAlertaOperativa } from "@/lib/observabilidad/alertas";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("no autorizado", { status: 401 });

  const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
  if (!perfil?.es_supersu) return new Response("prohibido", { status: 403 });

  const cupo = await limitar("alerta-prueba", user.id, 5, 300, { failClosed: true });
  if (!cupo.ok) {
    return new Response("demasiadas peticiones", { status: 429, headers: { "Retry-After": String(cupo.retryAfter) } });
  }

  const resultado = await enviarAlertaOperativa({
    tipo: "PRUEBA",
    titulo: "Alerta de prueba de observabilidad",
    detalle: { actor_id: user.id },
    severidad: "info",
  });

  return Response.json({ ok: resultado !== "fallida", resultado });
}
