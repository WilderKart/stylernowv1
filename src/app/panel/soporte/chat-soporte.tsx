"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { enviarMensajeChat, marcarChatLeido, obtenerChatSoporte, type ChatSoporte } from "./chat-actions";

export function ChatSoportePanel({
  inicial,
  errorInicial,
}: {
  inicial: ChatSoporte | null;
  errorInicial: string | null;
}) {
  const [chat, setChat] = useState<ChatSoporte | null>(inicial);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(errorInicial);

  const recargar = useCallback(async () => {
    const res = await obtenerChatSoporte();
    if (res.ok) setChat(res.data);
  }, []);

  useEffect(() => {
    if (!chat?.negocioId) return;
    const supabase = createClient();
    const filtro = `negocio_id=eq.${chat.negocioId}`;
    const canal = supabase
      .channel(`soporte-panel-${chat.negocioId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "soporte_mensaje", filter: filtro }, () => {
        void recargar();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "soporte_conversacion", filter: filtro }, () => {
        void recargar();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [chat?.negocioId, recargar]);

  useEffect(() => {
    if (!chat?.conversacionId || chat.noLeidosNegocio === 0) return;
    void marcarChatLeido(chat.conversacionId).then(() => recargar());
  }, [chat?.conversacionId, chat?.noLeidosNegocio, recargar]);

  async function enviar() {
    const cuerpo = mensaje.trim();
    if (!cuerpo) return setError("Escribe un mensaje antes de enviarlo.");
    setEnviando(true);
    setError(null);
    const res = await enviarMensajeChat(cuerpo);
    setEnviando(false);
    if (!res.ok) return setError(res.error);
    setMensaje("");
    await recargar();
  }

  return (
    <section className="mb-8 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5" aria-labelledby="titulo-chat-soporte">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="titulo-chat-soporte" className="font-display text-[16px] font-bold uppercase text-text">
            Chat en vivo con SuperSU
          </h2>
          <p className="text-[11.5px] text-text-faint">Respuesta directa del equipo de StylerNow.</p>
        </div>
        {chat?.estado ? (
          <span
            className={`rounded-none border px-2 py-1 font-mono text-[10px] font-bold uppercase ${
              chat.estado === "ABIERTA" ? "border-accent/40 text-accent" : "border-border text-text-faint"
            }`}
          >
            {chat.estado === "ABIERTA" ? "Abierta" : "Cerrada"}
          </span>
        ) : null}
      </div>

      <div className="mb-3 flex min-h-[140px] max-h-[320px] flex-col gap-2 overflow-y-auto rounded-xl border border-border-subtle bg-bg p-3" role="log">
        {chat?.mensajes.length ? (
          chat.mensajes.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] ${m.remitenteRol === "BARBERIA" ? "ml-auto bg-accent-soft text-text" : "mr-auto border border-border bg-surface text-text"}`}>
              <p className="mb-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide text-text-faint">
                {m.remitenteRol === "BARBERIA" ? "Tú" : "SuperSU"} · {new Date(m.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.cuerpo}</p>
            </div>
          ))
        ) : (
          <p className="m-auto text-center text-[12px] text-text-faint">Aún no hay mensajes. Escribe para iniciar el chat.</p>
        )}
      </div>

      {error ? <p className="mb-2 text-[12px] font-semibold text-danger">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="mensaje-chat-soporte">
          Mensaje para SuperSU
        </label>
        <textarea
          id="mensaje-chat-soporte"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          disabled={chat?.estado === "CERRADA"}
          maxLength={2000}
          placeholder={chat?.estado === "CERRADA" ? "Esta conversación está cerrada." : "Escribe tu mensaje..."}
          className="min-h-[64px] flex-1 resize-y rounded-xl border border-border bg-bg p-3 text-[13px] text-text outline-none focus:border-accent/60 disabled:opacity-60"
        />
        <Button size="sm" loading={enviando} disabled={chat?.estado === "CERRADA" || !mensaje.trim()} onClick={enviar}>
          Enviar mensaje
        </Button>
      </div>
    </section>
  );
}
