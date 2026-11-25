"use client";

import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import {
  cambiarEstadoChatAdmin,
  enviarMensajeChatAdmin,
  listarChatsAdmin,
  marcarChatLeidoAdmin,
  obtenerChatAdmin,
  type ChatAdmin,
  type ConversacionAdmin,
} from "./chat-actions";

export function ChatAdmin({
  conversacionesIniciales,
  errorInicial,
}: {
  conversacionesIniciales: ConversacionAdmin[];
  errorInicial: string | null;
}) {
  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(conversacionesIniciales[0]?.id ?? null);
  const [chat, setChat] = useState<ChatAdmin | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(errorInicial);

  const recargarLista = useCallback(async () => {
    const res = await listarChatsAdmin();
    if (res.ok) setConversaciones(res.data);
  }, []);

  const cargarDetalle = useCallback(async (id: string, marcarLeido: boolean) => {
    const res = await obtenerChatAdmin(id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setChat(res.data);
    if (marcarLeido && res.data.conversacion.noLeidosAdmin > 0) {
      await marcarChatLeidoAdmin(id);
      await recargarLista();
    }
  }, [recargarLista]);

  useEffect(() => {
    if (!seleccionadaId) return;
    void Promise.resolve(seleccionadaId).then((id) => cargarDetalle(id, true));
  }, [seleccionadaId, cargarDetalle]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("soporte-admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "soporte_mensaje" }, () => {
        void recargarLista();
        if (seleccionadaId) void cargarDetalle(seleccionadaId, false);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "soporte_conversacion" }, () => {
        void recargarLista();
        if (seleccionadaId) void cargarDetalle(seleccionadaId, false);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [seleccionadaId, cargarDetalle, recargarLista]);

  async function enviar() {
    const cuerpo = mensaje.trim();
    if (!cuerpo || !chat) return setError("Escribe un mensaje antes de enviarlo.");
    setEnviando(true);
    setError(null);
    const res = await enviarMensajeChatAdmin(chat.conversacion.negocioId, cuerpo);
    setEnviando(false);
    if (!res.ok) return setError(res.error);
    setMensaje("");
    await recargarLista();
    await cargarDetalle(chat.conversacion.id, false);
  }

  async function cambiarEstado(estado: "ABIERTA" | "CERRADA") {
    if (!chat) return;
    setError(null);
    const res = await cambiarEstadoChatAdmin(chat.conversacion.id, estado);
    if (!res.ok) return setError(res.error);
    await recargarLista();
    await cargarDetalle(chat.conversacion.id, false);
  }

  return (
    <section className="mb-8 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5" aria-labelledby="titulo-chat-admin">
      <div className="mb-3">
        <h2 id="titulo-chat-admin" className="font-display text-[16px] font-bold uppercase text-text">
          Chat interno de soporte
        </h2>
        <p className="text-[11.5px] text-text-faint">Conversaciones en tiempo real con las barberías.</p>
      </div>

      {error ? <p className="mb-3 text-[12px] font-semibold text-danger">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border-subtle bg-bg" aria-label="Conversaciones de soporte">
          {conversaciones.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-text-faint">Todavía no hay conversaciones.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {conversaciones.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeleccionadaId(c.id);
                      setError(null);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${
                      c.id === seleccionadaId ? "bg-accent-soft" : "hover:bg-surface"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-text">{c.negocioNombre ?? "Negocio"}</span>
                      <span className="block truncate text-[11px] text-text-faint">
                        {c.ultimoMensajePreview || "Sin mensajes"}
                      </span>
                    </span>
                    {c.noLeidosAdmin > 0 ? (
                      <span className="min-w-5 rounded-none bg-accent px-1.5 py-0.5 text-center font-mono text-[10px] font-bold text-white" aria-label={`${c.noLeidosAdmin} sin leer`}>
                        {c.noLeidosAdmin > 99 ? "99+" : c.noLeidosAdmin}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-[360px] flex-col rounded-xl border border-border-subtle bg-bg p-3">
          {!seleccionadaId || !chat ? (
            <p className="m-auto text-center text-[12px] text-text-faint">Selecciona una conversación.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[12.5px] font-bold text-text">{chat.conversacion.negocioNombre ?? "Negocio"}</p>
                  <p className="text-[10.5px] text-text-faint">
                    {chat.conversacion.ultimoMensajeAt
                      ? new Date(chat.conversacion.ultimoMensajeAt).toLocaleString("es-CO")
                      : "Sin actividad"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={chat.conversacion.estado === "ABIERTA" ? "accent" : "danger"}>
                    {chat.conversacion.estado === "ABIERTA" ? "Abierta" : "Cerrada"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => cambiarEstado(chat.conversacion.estado === "ABIERTA" ? "CERRADA" : "ABIERTA")}
                  >
                    {chat.conversacion.estado === "ABIERTA" ? "Cerrar" : "Reabrir"}
                  </Button>
                </div>
              </div>

              <div className="mb-3 flex max-h-[230px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-border-subtle bg-surface p-2" role="log">
                {chat.mensajes.length === 0 ? (
                  <p className="m-auto text-center text-[12px] text-text-faint">Sin mensajes.</p>
                ) : (
                  chat.mensajes.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] ${
                        m.remitenteRol === "SUPERSU" ? "ml-auto bg-accent-soft text-text" : "mr-auto border border-border bg-bg text-text"
                      }`}
                    >
                      <p className="mb-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide text-text-faint">
                        {m.remitenteRol === "SUPERSU" ? "Tú" : "Barbería"} · {new Date(m.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{m.cuerpo}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="mensaje-chat-admin">
                  Mensaje para la barbería
                </label>
                <textarea
                  id="mensaje-chat-admin"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  disabled={chat.conversacion.estado === "CERRADA"}
                  maxLength={2000}
                  placeholder={chat.conversacion.estado === "CERRADA" ? "Esta conversación está cerrada." : "Escribe tu respuesta..."}
                  className="min-h-[58px] flex-1 resize-y rounded-xl border border-border bg-surface p-2.5 text-[12.5px] text-text outline-none focus:border-accent/60 disabled:opacity-60"
                />
                <Button size="sm" loading={enviando} disabled={chat.conversacion.estado === "CERRADA" || !mensaje.trim()} onClick={enviar}>
                  Responder
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
