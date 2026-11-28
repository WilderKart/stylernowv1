"use client";

import { Button } from "@/components/ui/button";
import { hora } from "@/lib/formato";
import type { MensajeChat } from "@/lib/cliente/chat";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { enviarChatCita, listarChatCita, marcarChatCitaLeido } from "./actions";

const POLL_MS = 5000;
const RAPIDOS = ["Te esperamos a la hora de tu cita.", "Gracias por avisar.", "Cualquier cambio, escríbenos por aquí."];

/**
 * Chat de una cita visto desde el negocio. Mismo hilo que el cliente ve en «Chat con el negocio» (tabla chat_mensaje).
 * Se actualiza cada ~5 s mientras la pestaña está visible.
 */
export function ChatCita({
  reservaId,
  clienteNombre,
  cerrado,
}: {
  reservaId: string;
  clienteNombre: string;
  /** Citas canceladas / sin pagar / no presentadas: el chat queda solo de lectura. */
  cerrado: boolean;
}) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const ultimoLeido = useRef<string | null>(null);

  const refrescar = useCallback(async () => {
    const r = await listarChatCita(reservaId);
    if (r.ok) {
      setMensajes((prev) => {
        const ids = new Set(r.data.map((m) => m.id));
        // Conserva un mensaje recién enviado que la lista aún no trae.
        const extra = prev.filter((m) => !ids.has(m.id) && m.es_mio && Date.now() - new Date(m.created_at).getTime() < 15_000);
        return [...r.data, ...extra];
      });
      setError(null);
    } else {
      setError(r.error);
    }
    setCargando(false);
  }, [reservaId]);

  useEffect(() => {
    // Carga inicial y refresco periódico (todo asíncrono, sin setState síncrono dentro del efecto).
    const primero = setTimeout(() => void refrescar(), 0);
    const temporizador = setInterval(() => {
      if (document.visibilityState === "visible") void refrescar();
    }, POLL_MS);
    return () => {
      clearTimeout(primero);
      clearInterval(temporizador);
    };
  }, [refrescar]);

  // Marca leído al abrir y cuando llega un mensaje nuevo del cliente.
  useEffect(() => {
    const ultimo = [...mensajes].reverse().find((m) => !m.es_mio)?.id ?? "inicio";
    if (ultimoLeido.current === ultimo) return;
    ultimoLeido.current = ultimo;
    void marcarChatCitaLeido(reservaId);
  }, [mensajes, reservaId]);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  async function enviar(texto: string) {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    setError(null);
    const r = await enviarChatCita(reservaId, cuerpo);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setMensajes((prev) => (prev.some((m) => m.id === r.data.id) ? prev : [...prev, r.data]));
    setBorrador("");
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div
        role="log"
        aria-label={`Conversación con ${clienteNombre}`}
        aria-live="polite"
        className="flex max-h-[40vh] min-h-32 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-bg p-3"
      >
        {cargando ? (
          <p className="m-auto text-[12px] text-text-faint">Cargando mensajes…</p>
        ) : mensajes.length === 0 ? (
          <p className="m-auto max-w-[30ch] text-center text-[12px] text-text-faint">
            Aún no hay mensajes. Si {clienteNombre} te escribe, lo verás aquí.
          </p>
        ) : (
          mensajes.map((m) => (
            <div key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", m.es_mio ? "items-end self-end" : "items-start self-start")}>
              <div
                className={cn(
                  "rounded-xl px-3 py-2 text-[13.5px] leading-5 break-words whitespace-pre-wrap",
                  m.es_mio ? "bg-accent text-white" : "border border-border bg-app text-text"
                )}
              >
                {m.cuerpo}
              </div>
              <span className="text-[10.5px] text-text-faint">
                {hora(m.created_at)}
                {m.es_mio && m.leido_por_otro ? " · Leído" : ""}
              </span>
            </div>
          ))
        )}
        <div ref={fin} />
      </div>

      {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}

      {cerrado ? (
        <p className="text-[12px] text-text-faint">El chat de esta cita ya está cerrado: solo puedes leer la conversación.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {RAPIDOS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={enviando}
                onClick={() => void enviar(r)}
                className="rounded-full border border-border px-3 py-1 text-[11.5px] font-semibold text-text-muted"
              >
                {r}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(borrador);
            }}
            className="flex items-stretch gap-2"
          >
            <label htmlFor="chat-cita-msg" className="sr-only">
              Mensaje para {clienteNombre}
            </label>
            <input
              id="chat-cita-msg"
              value={borrador}
              maxLength={1000}
              autoComplete="off"
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="Escribe un mensaje…"
              className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-[13.5px] text-text"
            />
            <Button type="submit" loading={enviando} disabled={!borrador.trim()}>
              Enviar
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
