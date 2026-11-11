"use client";

import { ErrorAviso, Pantalla, Sec, Top } from "@/app/lealtad/ui-cliente";
import { Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TicketResumen } from "@/lib/cliente/soporte";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { crearTicketAccion } from "./actions";
import { EstadoTicket } from "./estado-ticket";
import { FAQS } from "./faq-data";

const TEMAS = ["CITA", "PAGO", "CUENTA", "OTRO"] as const;

export function VistaAyuda({ tickets, errorTickets }: { tickets: TicketResumen[]; errorTickets: string | null }) {
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState(0);
  const [tema, setTema] = useState<(typeof TEMAS)[number]>("PAGO");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);

  const termino = q.trim().toLowerCase();
  const faqs = FAQS.map((f, i) => ({ ...f, i })).filter((f) => !termino || `${f.q} ${f.a}`.toLowerCase().includes(termino));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setCreado(null);
    const r = await crearTicketAccion(tema, mensaje);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setMensaje("");
    setCreado(r.codigo ?? "");
  }

  return (
    <Pantalla className="pb-8">
      <Top titulo="/PERFIL/AYUDA" volverA="/perfil" />

      <div className="flex flex-col gap-3 px-4 pt-3.5 pb-2.5">
        <Poster as="h1" size={2}>
          Ayuda<span className="sn-hot">.</span>
        </Poster>
        <Input
          type="search"
          aria-label="Buscar en preguntas frecuentes"
          placeholder="Busca: cancelar, anticipo, reembolso…"
          leadingIcon={<Search aria-hidden className="size-5" />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Sec derecha={<span className="sn-meta">{`${faqs.length} DE ${FAQS.length}`}</span>}>01 / Preguntas frecuentes</Sec>
      <div className="border-t-2 border-border px-4">
        {faqs.map((f) => {
          const open = abierta === f.i;
          return (
            <div key={f.i} className="border-b border-border-subtle">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setAbierta(open ? -1 : f.i)}
                className="grid min-h-12 w-full grid-cols-[30px_1fr_20px] items-center gap-2 py-2 text-left"
              >
                <span className="sn-meta font-bold text-[var(--accent-text)]">{`0${f.i + 1}`}</span>
                <span className={cn("body break-words", open && "font-bold")}>{f.q}</span>
                <span aria-hidden className="font-mono text-lg font-bold">
                  {open ? "−" : "+"}
                </span>
              </button>
              {open ? <p className="body-sm pr-2 pb-3 pl-[38px] break-words text-text-muted">{f.a}</p> : null}
            </div>
          );
        })}
        {faqs.length === 0 ? <p className="sn-meta py-3">00 / SIN RESULTADOS · ESCRÍBENOS ABAJO</p> : null}
      </div>

      <form onSubmit={enviar} className="mx-4 mt-4 flex flex-col gap-2.5 border-2 border-border p-3">
        <h2 className="sn-num">02 / Crear ticket</h2>
        <div role="radiogroup" aria-label="Tema" className="flex flex-wrap gap-1.5">
          {TEMAS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tema === t}
              onClick={() => setTema(t)}
              className={cn("sn-chip", tema === t && "is-selected")}
            >
              {t}
            </button>
          ))}
        </div>
        <label htmlFor="ticket-mensaje" className="sr-only">
          Cuéntanos qué pasó
        </label>
        <textarea
          id="ticket-mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Cuéntanos qué pasó y el número de tu cita."
          className="min-h-24 w-full resize-none border-2 border-border bg-surface px-2.5 py-2 text-[15px] leading-5 text-text outline-none placeholder:text-text-muted focus:shadow-hard"
        />
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        {creado !== null ? (
          <p role="status" className="sn-meta break-words">
            {`TICKET ${creado} ENVIADO · TE RESPONDEMOS EN MENOS DE 24 HORAS`}
          </p>
        ) : null}
        <Button type="submit" size="lg" loading={enviando} disabled={mensaje.trim().length < 5} className="w-full justify-between">
          <span>Enviar ticket</span>
          <ArrowUpRight aria-hidden className="size-[18px]" />
        </Button>
      </form>

      <div className="px-4 pt-3.5">
        <h2 className="sn-num border-b-2 border-border pb-1.5">03 / Tus tickets</h2>
        {errorTickets ? (
          <div className="pt-3">
            <ErrorAviso>{errorTickets}</ErrorAviso>
          </div>
        ) : null}
        {tickets.map((k) => (
          <Link
            key={k.ticket_id}
            href={`/ayuda/ticket/${k.ticket_id}`}
            className="grid min-h-12 grid-cols-[62px_1fr_auto] items-center gap-2 border-b border-border-subtle py-1 text-text no-underline"
          >
            <span className="sn-meta">{k.codigo}</span>
            <span className="body truncate">{k.asunto}</span>
            <EstadoTicket estado={k.estado} />
          </Link>
        ))}
        {!errorTickets && tickets.length === 0 ? <p className="sn-meta py-3">00 / AÚN NO TIENES TICKETS</p> : null}
      </div>
    </Pantalla>
  );
}
