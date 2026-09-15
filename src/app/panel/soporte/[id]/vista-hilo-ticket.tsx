"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useState } from "react";
import { responderTicket, type MensajeTicket, type TicketResumen } from "../actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "accent"> = {
  ABIERTO: "accent",
  EN_PROCESO: "accent",
  RESUELTO: "success",
};

const ETIQUETA_ACTOR: Record<string, string> = {
  CLIENTE: "Cliente",
  STAFF: "Staff",
  GUARDIAN: "Guardian",
  BARBERIA: "Tú",
  SUPERSU: "StylerNow",
};

export function VistaHiloTicket({
  ticketInicial,
  mensajesIniciales,
}: {
  ticketInicial: TicketResumen;
  mensajesIniciales: MensajeTicket[];
  soySupersu: boolean;
}) {
  const [ticket, setTicket] = useState(ticketInicial);
  const [mensajes, setMensajes] = useState(mensajesIniciales);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setError(null);
    const res = await responderTicket(ticket.id, texto);
    setEnviando(false);
    if (!res.ok) return setError(res.error);
    setMensajes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), autorId: "yo", actorTipo: "BARBERIA", mensaje: texto, createdAt: new Date().toISOString() },
    ]);
    if (ticket.estado === "RESUELTO") setTicket((t) => ({ ...t, estado: "ABIERTO" }));
    setTexto("");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display text-[18px] font-bold text-text">{ticket.asunto}</h1>
        <Badge tone={ESTADO_TONO[ticket.estado] ?? "accent"}>{ticket.estado.replace("_", " ")}</Badge>
      </div>

      <div className="mb-5 flex flex-1 flex-col gap-3">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl p-3 text-[13px] ${
              m.actorTipo === "SUPERSU" ? "self-start bg-surface-2 text-text" : "self-end bg-accent-soft text-text"
            }`}
          >
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
              {ETIQUETA_ACTOR[m.actorTipo] ?? m.actorTipo} · {new Date(m.createdAt).toLocaleString("es-CO")}
            </p>
            <p className="leading-relaxed whitespace-pre-wrap">{m.mensaje}</p>
          </div>
        ))}
      </div>

      {error ? <p className="mb-2 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      <div className="flex gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí tu mensaje..."
          className="min-h-[52px] flex-1 rounded-xl border border-border bg-surface p-3 text-[13px] text-text outline-none focus:border-accent/60"
        />
        <Button loading={enviando} disabled={!texto.trim()} onClick={enviar}>
          Enviar
        </Button>
      </div>
    </main>
  );
}
