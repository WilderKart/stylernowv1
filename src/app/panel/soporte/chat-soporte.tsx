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
/** Cada cuánto se consulta si hay mensajes nuevos como respaldo del tiempo real. */
const RESPALDO_MS = 4000;

/** ¿El chat ya mostrado es idéntico al recién consultado? (mismo último mensaje, estado y no leídos) */
function mismoChat(a: ChatSoporte | null, b: ChatSoporte) {
  if (!a) return false;
  const ua = a.mensajes[a.mensajes.length - 1]?.id;
  const ub = b.mensajes[b.mensajes.length - 1]?.id;
  return a.conversacionId === b.conversacionId && a.mensajes.length === b.mensajes.length && ua === ub && a.estado === b.estado && a.noLeidosNegocio === b.noLeidosNegocio && a.chatIncluido === b.chatIncluido && a.mensajes.every((m, i) => m.leido === b.mensajes[i]?.leido);
}
const CHIPS_INICIO = ["Configurar pagos / Nequi", "Duda sobre mi plan", "Verificación de mi negocio", "Reportar un error"];

/** Chat en vivo con el equipo de StylerNow (Studio, Prestige y Signature). Essential ve un aviso con el camino alternativo. */
export function ChatSoportePanel({ inicial, errorInicial, alIrATickets }: { inicial: ChatSoporte | null; errorInicial: string | null; alIrATickets: () => void }) {
  const [chat, setChat] = useState<ChatSoporte | null>(inicial);
  const [errorCarga] = useState(errorInicial);

  const recargar = useCallback(async () => {
    const res = await obtenerChatSoporte();
    // Solo se actualiza si algo cambió: así el respaldo periódico no repinta ni mueve el scroll sin necesidad.
    if (res.ok) setChat((prev) => (mismoChat(prev, res.data) ? prev : res.data));
  }, []);

  // Tiempo real: cualquier mensaje o cambio de estado de ESTE negocio vuelve a cargar el hilo (RLS filtra lo demás).
  useEffect(() => {
    if (!chat?.negocioId || !chat.chatIncluido) return;
    const supabase = createClient();
    const filtro = `negocio_id=eq.${chat.negocioId}`;
    // El canal debe conectarse YA autenticado con la sesión: si se suscribe antes de que Realtime tenga el token, la base
    // rechaza la suscripción con filtro ("Unable to subscribe…") y los mensajes de soporte no llegan hasta recargar.
    let cancelado = false;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    const negocioId = chat.negocioId;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelado) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelado) return;
      canal = supabase
        .channel(`soporte-panel-${negocioId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "soporte_mensaje", filter: filtro }, () => void recargar())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "soporte_conversacion", filter: filtro }, () => void recargar())
        .subscribe();
    })();
    // Respaldo por si el canal en tiempo real se cae: consulta cada pocos segundos con la pestaña visible y al volver a ella.
    const siVisible = () => {
      if (document.visibilityState === "visible") void recargar();
    };
    const temporizador = window.setInterval(siVisible, RESPALDO_MS);
    document.addEventListener("visibilitychange", siVisible);
    window.addEventListener("online", siVisible);
    window.addEventListener("focus", siVisible);
    return () => {
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", siVisible);
      window.removeEventListener("online", siVisible);
      window.removeEventListener("focus", siVisible);
      cancelado = true;
      if (canal) void supabase.removeChannel(canal);
    };
  }, [chat?.negocioId, chat?.chatIncluido, recargar]);

  useEffect(() => {
    if (!chat?.conversacionId || chat.noLeidosNegocio === 0) return;
    void marcarChatLeido(chat.conversacionId).then(() => recargar());
  }, [chat?.conversacionId, chat?.noLeidosNegocio, recargar]);

  const onEnviar = useCallback(
    async (cuerpo: string, adjunto: AdjuntoSubido | null) => {
      // El mensaje aparece al instante (optimista); la consulta que sigue lo reemplaza por el real sin hacer esperar a quien escribe.
      const idTemporal = `tmp-${Date.now()}`;
      setChat((prev) =>
        prev
          ? { ...prev, mensajes: [...prev.mensajes, { id: idTemporal, conversacionId: prev.conversacionId ?? "", negocioId: prev.negocioId, remitenteRol: "BARBERIA", cuerpo, createdAt: new Date().toISOString(), leido: false, adjunto: adjunto ? { tipo: adjunto.tipo, nombre: adjunto.nombre, url: null } : null }] }
          : prev,
      );
      const res = await enviarMensajeChat(cuerpo, adjunto);
      if (!res.ok) {
        setChat((prev) => (prev ? { ...prev, mensajes: prev.mensajes.filter((m) => m.id !== idTemporal) } : prev));
        return res.error;
      }
      void recargar();
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
    <section className={cn(s.tarjeta, s.alturaChat)} aria-labelledby="titulo-chat-soporte">
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
        avatarYo="/avatars/negocio.svg"
        cerrada={cerrada}
        chipsInicio={CHIPS_INICIO}
        onEnviar={onEnviar}
        placeholder="Escribe un mensaje…"
        prepararSubida={prepararSubida}
      />
    </section>
  );
}
