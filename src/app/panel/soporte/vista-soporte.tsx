"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";
import { crearTicket, type TicketResumen } from "./actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "accent"> = {
  ABIERTO: "accent",
  EN_PROCESO: "accent",
  RESUELTO: "success",
};

export function VistaSoporte({
  negocioId,
  ticketsIniciales,
  errorInicial,
}: {
  negocioId: string;
  ticketsIniciales: TicketResumen[];
  errorInicial: string | null;
}) {
  const [tickets, setTickets] = useState(ticketsIniciales);
  const [creando, setCreando] = useState(false);
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(errorInicial);

  async function crear() {
    if (!asunto.trim() || !mensaje.trim()) return setError("Completá el asunto y el mensaje.");
    setGuardando(true);
    setError(null);
    const res = await crearTicket(asunto, mensaje, negocioId);
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setTickets((prev) => [
      { id: res.data.id, asunto, estado: "ABIERTO", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ...prev,
    ]);
    setAsunto("");
    setMensaje("");
    setCreando(false);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-[22px] font-bold uppercase text-text">Soporte</h1>
        <Button size="sm" variant="secondary" onClick={() => setCreando((v) => !v)}>
          {creando ? "Cancelar" : "Nuevo ticket"}
        </Button>
      </div>

      {creando ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
          <Input label="Asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="¿En qué te podemos ayudar?" />
          <div className="flex flex-col gap-2">
            <label className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Mensaje</label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              className="min-h-[100px] rounded-xl border border-border bg-bg p-3 text-[13px] text-text outline-none focus:border-accent/60"
              placeholder="Contanos el detalle de tu consulta o problema..."
            />
          </div>
          <Button size="sm" loading={guardando} onClick={crear}>
            Enviar ticket
          </Button>
        </div>
      ) : null}

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {tickets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          Todavía no creaste ningún ticket de soporte.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/panel/soporte/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 hover:border-accent/40"
              >
                <div>
                  <p className="text-[13.5px] font-semibold text-text">{t.asunto}</p>
                  <p className="text-[11px] text-text-faint">Actualizado {new Date(t.updatedAt).toLocaleDateString("es-CO")}</p>
                </div>
                <Badge tone={ESTADO_TONO[t.estado] ?? "accent"}>{t.estado.replace("_", " ")}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
