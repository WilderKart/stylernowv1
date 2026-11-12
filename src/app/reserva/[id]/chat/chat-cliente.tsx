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
import { useT } from "@/lib/i18n/proveedor";
import { useIdioma } from "@/lib/i18n/proveedor";
import type { Traductor } from "@/lib/i18n/diccionario";
import { enviarMensajeAction, listarMensajesAction, marcarLeidoAction } from "../actions-cita";

const RAPIDOS = ["chat.rapido_camino", "chat.rapido_tarde", "chat.rapido_gracias"] as const;
const POLL_MS = 5000;

function etiquetaDia(iso: string, tz: string, t: Traductor, locale: string) {
  if (fechaISO(iso, tz) === fechaISO(new Date(), tz)) return t("chat.hoy");
  return new Intl.DateTimeFormat(locale, { timeZone: tz, day: "numeric", month: "short" }).format(new Date(iso)).toUpperCase();
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
  const t = useT();
  const idioma = useIdioma();
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
    const temporizador = setInterval(() => {
      if (document.visibilityState === "visible") void refrescar();
    }, POLL_MS);
    return () => clearInterval(temporizador);
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
      setError(t("chat.err_enviar"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla className="h-dvh min-h-0">
      <div className="p-top">
        <Link href={`/reserva/${reservaId}`} className="sn-iconbtn" aria-label={t("comun.volver")}>
          <ChevronLeft aria-hidden />
        </Link>
        <Avatar name={negocio} src={logo} size="sm" />
        <div className="min-w-0 flex-1">
          <b className="block truncate uppercase">{negocio}</b>
          <span className="sn-meta block truncate">{t("chat.de_tu_cita")}</span>
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

      <div role="log" aria-label={t("chat.conversacion")} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {mensajes.length === 0 ? (
          <p className="sn-meta m-auto max-w-[28ch] text-center">{t("chat.sin_mensajes")}</p>
        ) : null}
        {mensajes.map((m, i) => {
          const separador =
            i === 0 || fechaISO(m.created_at, tz) !== fechaISO(mensajes[i - 1].created_at, tz) ? etiquetaDia(m.created_at, tz, t, idioma === "en" ? "en-US" : "es-CO") : null;
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
                  {m.es_mio && m.leido_por_otro ? t("chat.leido") : ""}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={fin} />
      </div>

      {sinRed ? (
        <p role="status" className="sn-meta px-4 pb-2">
          {t("chat.sin_conexion")}
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
            {RAPIDOS.map((r) => (
              <button key={r} type="button" className="sn-chip" disabled={enviando} onClick={() => enviar(t(r))}>
                {t(r)}
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
              {t("chat.mensaje")}
            </label>
            <div className="sn-input min-w-0 flex-1">
              <input
                id="msg"
                value={borrador}
                maxLength={1000}
                autoComplete="off"
                onChange={(e) => setBorrador(e.target.value)}
                placeholder={t("chat.escribe")}
              />
            </div>
            <Button type="submit" size="md" aria-label={t("chat.enviar")} loading={enviando} disabled={!borrador.trim()}>
              {t("chat.enviar")}
              <Send aria-hidden className="size-[18px]" />
            </Button>
          </form>
        </>
      ) : (
        <p className="sn-meta border-t-2 border-border p-4 text-center">{t("chat.cerrado")}</p>
      )}
    </Pantalla>
  );
}
