"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useState } from "react";
import { actualizarEstadoTicket, responderTicketAdmin, type MensajeTicketAdmin, type TicketAdmin } from "../actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "accent"> = {
  ABIERTO: "accent",
  EN_PROCESO: "accent",
  RESUELTO: "success",
};

const ETIQUETA_ACTOR: Record<string, string> = {
  CLIENTE: "Cliente",
  STAFF: "Staff",
  GUARDIAN: "Guardian",
  BARBERIA: "Negocio",
  SUPERSU: "Tú (StylerNow)",
};

const ESTADOS: ("ABIERTO" | "EN_PROCESO" | "RESUELTO")[] = ["ABIERTO", "EN_PROCESO", "RESUELTO"];

export function VistaHiloTicketAdmin({
  ticketInicial,
  mensajesIniciales,
}: {
  ticketInicial: TicketAdmin;
  mensajesIniciales: MensajeTicketAdmin[];
}) {
  const [ticket, setTicket] = useState(ticketInicial);
  const [mensajes, setMensajes] = useState(mensajesIniciales);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setError(null);
    const res = await responderTicketAdmin(ticket.id, texto);
    setEnviando(false);
    if (!res.ok) return setError(res.error);
    setMensajes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), autorId: "yo", actorTipo: "SUPERSU", mensaje: texto, createdAt: new Date().toISOString() },
    ]);
    setTexto("");
  }

  async function cambiarEstado(estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO") {
    setCambiando(true);
    setError(null);
    const res = await actualizarEstadoTicket(ticket.id, estado);
    setCambiando(false);
    if (!res.ok) return setError(res.error);
    setTicket((t) => ({ ...t, estado }));
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="font-display text-[18px] font-bold text-text">{ticket.asunto}</h1>
        <Badge tone={ESTADO_TONO[ticket.estado] ?? "accent"}>{ticket.estado.replace("_", " ")}</Badge>
      </div>
      <p className="mb-5 text-[11.5px] text-text-faint">{ticket.negocioNombre ?? "Sin negocio asociado"}</p>

      <div className="mb-5 flex gap-1.5">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            disabled={cambiando || ticket.estado === e}
            onClick={() => cambiarEstado(e)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold disabled:opacity-40 ${
              ticket.estado === e ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
            }`}
          >
            {e.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-1 flex-col gap-3">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl p-3 text-[13px] ${
              m.actorTipo === "SUPERSU" ? "self-end bg-accent-soft text-text" : "self-start bg-surface-2 text-text"
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
          placeholder="Escribí tu respuesta..."
          className="min-h-[52px] flex-1 rounded-xl border border-border bg-surface p-3 text-[13px] text-text outline-none focus:border-accent/60"
        />
        <Button loading={enviando} disabled={!texto.trim()} onClick={enviar}>
          Enviar
        </Button>
      </div>
    </>
  );
}
