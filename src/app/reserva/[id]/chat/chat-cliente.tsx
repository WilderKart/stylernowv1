"use client";

import { ErrorAviso, horaCorta, Pantalla } from "@/app/lealtad/ui-cliente";
import { Avatar } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import type { MensajeChat } from "@/lib/cliente/chat";
import { fechaISO } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { ChevronLeft, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { enviarMensajeAction, listarMensajesAction, marcarLeidoAction } from "../actions-cita";

const RAPIDOS = ["Voy en camino", "Llego 10 min tarde", "Gracias"];
const POLL_MS = 5000;

function etiquetaDia(iso: string, tz: string) {
  if (fechaISO(iso, tz) === fechaISO(new Date(), tz)) return "Hoy";
  return new Intl.DateTimeFormat("es-CO", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(iso)).toUpperCase();
}

export function ChatCliente({
  reservaId,
  negocio,
  logo,
  resumen,
  tz,
  habilitado,
  iniciales,
  errorInicial,
}: {
  reservaId: string;
  negocio: string;
  logo: string | null;
  resumen: string;
  tz: string;
  habilitado: boolean;
  iniciales: MensajeChat[];
  errorInicial: string | null;
}) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>(iniciales);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(errorInicial);
  const [sinRed, setSinRed] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const ultimoLeido = useRef<string | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const r = await listarMensajesAction(reservaId);
      if (r.ok) {
        setMensajes((prev) => {
          // Conserva un mensaje recién enviado que la lista aún no trae.
          const ids = new Set(r.data.map((m) => m.id));
          const extra = prev.filter((m) => !ids.has(m.id) && m.es_mio && Date.now() - new Date(m.created_at).getTime() < 15_000);
          return [...r.data, ...extra];
        });
        setSinRed(false);
      }
    } catch {
      setSinRed(true);
    }
  }, [reservaId]);

  // Polling cada ~5 s mientras la pestaña está visible (no hay realtime).
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refrescar();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refrescar]);

  // Marcar leído al abrir y cuando llega un mensaje nuevo del negocio.
  useEffect(() => {
    const ultimo = [...mensajes].reverse().find((m) => !m.es_mio)?.id ?? "inicio";
    if (ultimoLeido.current === ultimo) return;
    ultimoLeido.current = ultimo;
    marcarLeidoAction(reservaId).catch(() => {});
  }, [mensajes, reservaId]);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  async function enviar(texto: string) {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await enviarMensajeAction(reservaId, cuerpo);
      if (!r.ok) return setError(r.error);
      setMensajes((prev) => (prev.some((m) => m.id === r.data.id) ? prev : [...prev, r.data]));
      setBorrador("");
    } catch {
      setError("No pudimos enviar el mensaje. Revisa tu conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla className="h-dvh min-h-0">
      <div className="p-top">
        <Link href={`/reserva/${reservaId}`} className="sn-iconbtn" aria-label="Volver">
          <ChevronLeft aria-hidden />
        </Link>
        <Avatar name={negocio} src={logo} size="sm" />
        <div className="min-w-0 flex-1">
          <b className="block truncate uppercase">{negocio}</b>
          <span className="sn-meta block truncate">Chat de tu cita</span>
        </div>
      </div>

      <Link
        href={`/reserva/${reservaId}`}
        className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-3 text-text no-underline"
      >
        <span className="sn-meta min-w-0 break-words">{resumen}</span>
        <span aria-hidden className="sn-label">
          ↗
        </span>
      </Link>

      <div role="log" aria-label="Conversación" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {mensajes.length === 0 ? (
          <p className="sn-meta m-auto max-w-[28ch] text-center">Aún no hay mensajes. Escríbele al negocio sobre tu cita.</p>
        ) : null}
        {mensajes.map((m, i) => {
          const separador =
            i === 0 || fechaISO(m.created_at, tz) !== fechaISO(mensajes[i - 1].created_at, tz) ? etiquetaDia(m.created_at, tz) : null;
          return (
            <div key={m.id} className="flex flex-col gap-3">
              {separador ? (
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border-subtle" />
                  <span className="sn-num">{separador}</span>
                  <span className="h-px flex-1 bg-border-subtle" />
                </div>
              ) : null}
              <div className={cn("flex max-w-[85%] flex-col gap-1", m.es_mio ? "items-end self-end" : "items-start self-start")}>
                <div
                  className={cn(
                    "border-2 px-3 py-2 text-[15px] leading-[22px] break-words whitespace-pre-wrap",
                    m.es_mio ? "border-ink bg-signal text-ink shadow-hard-sm" : "border-border bg-surface text-text"
                  )}
                >
                  {m.cuerpo}
                </div>
                <span className="sn-meta">
                  {horaCorta(m.created_at, tz)}
                  {m.es_mio && m.leido_por_otro ? " · Leído" : ""}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={fin} />
      </div>

      {sinRed ? (
        <p role="status" className="sn-meta px-4 pb-2">
          Sin conexión: reintentando…
        </p>
      ) : null}
      {error ? (
        <div className="px-4 pb-2">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      {habilitado ? (
        <>
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {RAPIDOS.map((t) => (
              <button key={t} type="button" className="sn-chip" disabled={enviando} onClick={() => enviar(t)}>
                {t}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(borrador);
            }}
            className="flex items-stretch gap-2 border-t-2 border-border bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <label htmlFor="msg" className="sr-only">
              Mensaje
            </label>
            <div className="sn-input min-w-0 flex-1">
              <input
                id="msg"
                value={borrador}
                maxLength={1000}
                autoComplete="off"
                onChange={(e) => setBorrador(e.target.value)}
                placeholder="Escribe un mensaje…"
              />
            </div>
            <Button type="submit" size="md" aria-label="Enviar" loading={enviando} disabled={!borrador.trim()}>
              Enviar
              <Send aria-hidden className="size-[18px]" />
            </Button>
          </form>
        </>
      ) : (
        <p className="sn-meta border-t-2 border-border p-4 text-center">El chat de esta cita ya está cerrado.</p>
      )}
    </Pantalla>
  );
}
