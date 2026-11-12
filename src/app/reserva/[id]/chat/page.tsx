import { Bloque, diaYMes, horaCorta, Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { listarMensajes } from "@/lib/cliente/chat";
import { obtenerDetalleCita } from "@/lib/cliente/citas";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ChatCliente } from "./chat-cliente";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("chat.meta"), robots: { index: false, follow: false } };
}

export default async function ChatPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const t = await obtenerT();
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
        <Top titulo={t("chat.titulo")} volverA={`/reserva/${id}`} />
        <Bloque etiqueta={t("cal.error")}>{r.error}</Bloque>
      </Pantalla>
    );
  }
  const c = r.data;
  const m = await listarMensajes(id, { limite: 50 });
  const dm = diaYMes(c.hora_inicio, c.zona_horaria);
  const servicios = c.servicios.map((s) => s.nombre).join(" + ") || t("rv.servicio");

  return (
    <ChatCliente
      reservaId={id}
      negocio={c.negocio.nombre}
      logo={c.negocio.logo_url}
      resumen={t("chat.resumen", { codigo: c.codigo, dia: dm.dia, mes: dm.mes, hora: horaCorta(c.hora_inicio, c.zona_horaria), servicios })}
      tz={c.zona_horaria}
      habilitado={c.chat_habilitado}
      iniciales={m.ok ? m.data : []}
      errorInicial={m.ok ? null : m.error}
    />
  );
}
