"use client";

import { ErrorAviso, Pantalla, Sec, Top } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import type { MensajeTicket, TicketResumen } from "@/lib/cliente/soporte";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { responderTicketAccion } from "../../actions";
import { EstadoTicket } from "../../estado-ticket";

function hora(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(iso))
    .replace(".", "")
    .toUpperCase();
}

export function VistaTicket({ id, ticket, mensajes, error }: { id: string; ticket: TicketResumen | null; mensajes: MensajeTicket[]; error: string | null }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const resuelto = ticket?.estado === "RESUELTO";

  async function responder(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setFallo(null);
    const r = await responderTicketAccion(id, texto);
    setEnviando(false);
    if (!r.ok) {
      setFallo(r.error);
      return;
    }
    setTexto("");
    router.refresh();
  }

  return (
    <Pantalla className="pb-8">
      <Top titulo={`/AYUDA/${ticket?.codigo ?? "TICKET"}`} volverA="/ayuda" />
      <div className="flex flex-col items-start gap-2 p-4">
        {ticket ? <EstadoTicket estado={ticket.estado} /> : null}
        <h1 className="poster-4 break-words">{ticket?.asunto ?? "Ticket"}</h1>
        {ticket ? <span className="sn-meta">{`${ticket.categoria} · ${hora(ticket.created_at)}`}</span> : null}
      </div>

      <Sec>01 / Conversación</Sec>
      <div className="flex flex-col gap-3 border-t-2 border-border p-4">
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        {mensajes.map((m) => (
          <div key={m.id} className={cn("flex max-w-[88%] flex-col gap-1", m.es_mio ? "items-end self-end" : "self-start")}>
            <span className="sn-meta">{`${m.es_mio ? "TÚ" : "STYLERNOW"} · ${hora(m.created_at)}`}</span>
            <p className={cn("body-sm border-2 border-border px-3 py-2 break-words whitespace-pre-wrap", m.es_mio ? "bg-signal text-ink" : "bg-surface")}>{m.mensaje}</p>
          </div>
        ))}
        {!error && mensajes.length === 0 ? <p className="sn-meta">00 / SIN MENSAJES</p> : null}
      </div>

      {resuelto ? (
        <p className="sn-meta px-4">TICKET RESUELTO · SI LO NECESITAS, CREA UNO NUEVO DESDE AYUDA.</p>
      ) : (
        <form onSubmit={responder} className="mx-4 flex flex-col gap-2.5 border-2 border-border p-3">
          <h2 className="sn-num">02 / Responder</h2>
          <label htmlFor="resp" className="sr-only">
            Tu respuesta
          </label>
          <textarea
            id="resp"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Escribe tu respuesta."
            className="min-h-24 w-full resize-none border-2 border-border bg-surface px-2.5 py-2 text-[15px] leading-5 text-text outline-none placeholder:text-text-muted focus:shadow-hard"
          />
          {fallo ? <ErrorAviso>{fallo}</ErrorAviso> : null}
          <Button type="submit" size="lg" loading={enviando} disabled={!texto.trim()} className="w-full justify-between">
            <span>Enviar respuesta</span>
            <ArrowUpRight aria-hidden className="size-[18px]" />
          </Button>
        </form>
      )}
    </Pantalla>
  );
}
