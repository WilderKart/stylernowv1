"use client";

import { HiloChat } from "@/components/soporte/hilo-chat";
import s from "@/components/soporte/chat-3d.module.css";
import type { AdjuntoSubido } from "@/lib/soporte/tipos";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { enviarMensajeChat, marcarChatLeido, obtenerChatSoporte, prepararAdjuntosChat, type ChatSoporte } from "./chat-actions";

const AVATAR_SOPORTE = "/avatars/soporte-stylernow.png";
const CHIPS_INICIO = ["Configurar pagos / Nequi", "Duda sobre mi plan", "Verificación de mi negocio", "Reportar un error"];

/** Chat en vivo con el equipo de StylerNow (Studio, Prestige y Signature). Essential ve un aviso con el camino alternativo. */
export function ChatSoportePanel({ inicial, errorInicial, alIrATickets }: { inicial: ChatSoporte | null; errorInicial: string | null; alIrATickets: () => void }) {
  const [chat, setChat] = useState<ChatSoporte | null>(inicial);
  const [errorCarga] = useState(errorInicial);

  const recargar = useCallback(async () => {
    const res = await obtenerChatSoporte();
    if (res.ok) setChat(res.data);
  }, []);

  // Tiempo real: cualquier mensaje o cambio de estado de ESTE negocio vuelve a cargar el hilo (RLS filtra lo demás).
  useEffect(() => {
    if (!chat?.negocioId || !chat.chatIncluido) return;
    const supabase = createClient();
    const filtro = `negocio_id=eq.${chat.negocioId}`;
    const canal = supabase
      .channel(`soporte-panel-${chat.negocioId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "soporte_mensaje", filter: filtro }, () => void recargar())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "soporte_conversacion", filter: filtro }, () => void recargar())
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [chat?.negocioId, chat?.chatIncluido, recargar]);

  useEffect(() => {
    if (!chat?.conversacionId || chat.noLeidosNegocio === 0) return;
    void marcarChatLeido(chat.conversacionId).then(() => recargar());
  }, [chat?.conversacionId, chat?.noLeidosNegocio, recargar]);

  const onEnviar = useCallback(
    async (cuerpo: string, adjunto: AdjuntoSubido | null) => {
      const res = await enviarMensajeChat(cuerpo, adjunto);
      if (!res.ok) return res.error;
      await recargar();
      return null;
    },
    [recargar],
  );

  const prepararSubida = useCallback(async () => {
    const res = await prepararAdjuntosChat();
    return res.ok ? res.data : null;
  }, []);

  if (errorCarga && !chat) {
    return (
      <div className={cn(s.tarjeta, "p-6")} role="alert">
        <p className="font-bold">No pudimos cargar el chat.</p>
        <p className="text-sm opacity-80">{errorCarga}</p>
      </div>
    );
  }

  // Essential: sin chat en vivo. Se explica y se ofrece el camino que sí incluye su plan.
  if (chat && !chat.chatIncluido) {
    return (
      <section className={cn(s.tarjeta, "items-start gap-3 p-6 sm:p-8")} aria-labelledby="chat-no-incluido">
        <span className={s.avatarMarco} style={{ width: 64, height: 64 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar estático local */}
          <img src={AVATAR_SOPORTE} alt="" className={s.avatar} />
        </span>
        <h2 id="chat-no-incluido" className={s.titulo}>
          El chat en vivo está incluido desde el plan Studio
        </h2>
        <p className={s.subtitulo} style={{ maxWidth: 560, fontSize: 15 }}>
          Con tu plan actual puedes escribirnos por tickets y te respondemos por correo y dentro del panel. Si quieres conversar en tiempo real con el equipo de StylerNow, mejora tu plan.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" className={cn(s.chip, s.enviar)} style={{ color: "#fff" }} onClick={alIrATickets}>
            Crear un ticket
          </button>
          <Link href="/panel/suscripcion" className={s.chip} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Lock className="size-4" aria-hidden /> Ver planes
          </Link>
          <Link href="/ayuda" className={s.chip} style={{ display: "inline-flex", alignItems: "center" }}>
            Centro de ayuda
          </Link>
        </div>
      </section>
    );
  }

  const cerrada = chat?.estado === "CERRADA";
  return (
    <section className={s.tarjeta} style={{ height: "min(74dvh, 720px)", minHeight: 460 }} aria-labelledby="titulo-chat-soporte">
      <header className={s.cabecera}>
        <span className={s.avatarMarco}>
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar estático local */}
          <img src={AVATAR_SOPORTE} alt="" className={s.avatar} />
          <span className={s.enLinea} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="titulo-chat-soporte" className={s.titulo}>
            Soporte StylerNow
          </h2>
          <p className={s.subtitulo}>
            Equipo de StylerNow · En línea{chat?.prioritario ? " · Atención prioritaria" : ""}
          </p>
        </div>
        <span className={cn(s.estado, cerrada && s.estadoCerrada)}>{cerrada ? "Cerrada" : "Abierta"}</span>
      </header>
      <HiloChat
        mensajes={chat?.mensajes ?? []}
        miRol="BARBERIA"
        nombreOtro="Soporte StylerNow"
        avatarOtro={AVATAR_SOPORTE}
        cerrada={cerrada}
        chipsInicio={CHIPS_INICIO}
        onEnviar={onEnviar}
        prepararSubida={prepararSubida}
      />
    </section>
  );
}
