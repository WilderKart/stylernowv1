import { Bloque, diaYMes, horaCorta, Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { listarMensajes } from "@/lib/cliente/chat";
import { obtenerDetalleCita } from "@/lib/cliente/citas";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ChatCliente } from "./chat-cliente";

export const metadata = {
  title: "Chat con el negocio",
  robots: { index: false, follow: false },
};

export default async function ChatPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/reserva/${id}/chat`);

  const r = await obtenerDetalleCita(id);
  if (!r.ok) {
    if (r.codigo === "RESERVA_NO_ENCONTRADA" || r.codigo === "NO_AUTORIZADO") notFound();
    return (
      <Pantalla>
        <Top titulo="Chat" volverA={`/reserva/${id}`} />
        <Bloque etiqueta="00 / Error">{r.error}</Bloque>
      </Pantalla>
    );
  }
  const c = r.data;
  const m = await listarMensajes(id, { limite: 50 });
  const dm = diaYMes(c.hora_inicio, c.zona_horaria);
  const servicios = c.servicios.map((s) => s.nombre).join(" + ") || "Servicio";

  return (
    <ChatCliente
      reservaId={id}
      negocio={c.negocio.nombre}
      logo={c.negocio.logo_url}
      resumen={`Cita ${c.codigo} · ${dm.dia} ${dm.mes} ${horaCorta(c.hora_inicio, c.zona_horaria)} · ${servicios}`}
      tz={c.zona_horaria}
      habilitado={c.chat_habilitado}
      iniciales={m.ok ? m.data : []}
      errorInicial={m.ok ? null : m.error}
    />
  );
}
