"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Notificacion, TipoNotificacion } from "@/lib/cliente/notificaciones";
import { useEnLinea } from "@/lib/hooks/use-en-linea";
import { cn } from "@/lib/utils";
import { Bell, CalendarCheck, CalendarClock, CalendarX, Clock, MessageSquare, Star, Tag, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useIdioma, useT } from "@/lib/i18n/proveedor";
import { marcarLeidaAction, marcarTodasLeidasAction } from "./actions";

const ICONOS: Record<TipoNotificacion, typeof Clock> = {
  CITA_CONFIRMADA: CalendarCheck,
  CITA_CANCELADA: CalendarX,
  CITA_REPROGRAMADA: CalendarClock,
  CITA_RECORDATORIO: Clock,
  CALIFICAR_VISITA: Star,
  CHAT_MENSAJE: MessageSquare,
  OFERTA: Tag,
  SISTEMA: Bell,
};

/** Destino al tocar: cada aviso abre la pantalla exacta (detalle de la cita, chat o calificación). */
function destino(n: Notificacion): string | null {
  if (n.tipo === "OFERTA") return "/ofertas";
  if (n.tipo === "SISTEMA") return null;
  if (!n.reserva_id) return null;
  if (n.tipo === "CHAT_MENSAJE") return `/reserva/${n.reserva_id}/chat`;
  if (n.tipo === "CALIFICAR_VISITA") return `/reserva/${n.reserva_id}/calificar`;
  return `/reserva/${n.reserva_id}`;
}

const TZ = "America/Bogota";
const DIA = 86_400_000;

function claveDia(ms: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ms);
}

function grupoDe(iso: string, ahora: number): 0 | 1 | 2 {
  const t = new Date(iso).getTime();
  if (claveDia(t) === claveDia(ahora)) return 0;
  return ahora - t < 7 * DIA ? 1 : 2;
}

function etiquetaHora(iso: string, ahora: number, loc: string) {
  const t = new Date(iso).getTime();
  const g = grupoDe(iso, ahora);
  if (g === 0) {
    return new Intl.DateTimeFormat(loc, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
  }
  if (g === 1) {
    return new Intl.DateTimeFormat(loc, { timeZone: TZ, weekday: "short" }).format(t).replace(".", "").toUpperCase();
  }
  return new Intl.DateTimeFormat(loc, { timeZone: TZ, day: "2-digit", month: "short" }).format(t).replace(".", "").toUpperCase();
}

const TITULOS_GRUPO = ["not.hoy", "not.semana", "not.antes"] as const;

export function ListaNotificaciones({
  notificaciones,
  error,
  ahora,
}: {
  notificaciones: Notificacion[];
  error: string | null;
  ahora: number;
}) {
  const router = useRouter();
  const t = useT();
  const idioma = useIdioma();
  const enLinea = useEnLinea();
  const [items, setItems] = useState(notificaciones);
  const [aviso, setAviso] = useState<string | null>(error);
  const [pendiente, iniciar] = useTransition();

  const sinLeer = items.filter((n) => !n.leida).length;

  function marcarTodas() {
    const previo = items;
    setItems((l) => l.map((n) => ({ ...n, leida: true })));
    setAviso(null);
    iniciar(async () => {
      const r = await marcarTodasLeidasAction();
      if (!r.ok) {
        setItems(previo);
        setAviso(r.error ?? t("not.err_marcar"));
      } else {
        router.refresh();
      }
    });
  }

  function abrir(n: Notificacion) {
    const ruta = destino(n);
    if (!n.leida) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      // Se espera a que quede guardado antes de navegar para que el contador de la campana ya sea correcto.
      iniciar(async () => {
        await marcarLeidaAction(n.id);
        if (ruta) router.push(ruta);
        else router.refresh();
      });
      return;
    }
    if (ruta) router.push(ruta);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-3 pb-4">
        <h1 className="poster-2 break-words">
          {t("not.avisos")}<span className="sn-hot">.</span>
        </h1>
        {items.length > 0 ? (
          <Button variant="secondary" size="md" onClick={marcarTodas} disabled={sinLeer === 0 || pendiente || !enLinea}>
            {t("not.marcar_todo")}
          </Button>
        ) : null}
      </div>

      {!enLinea ? (
        <p role="status" className="sn-status sn-status--warn mx-4 mb-3">
          <WifiOff aria-hidden /> {t("not.sin_conexion")}
        </p>
      ) : null}
      {aviso ? (
        <div className="mx-4 mb-3">
          <ErrorAviso>{aviso}</ErrorAviso>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="mx-4 mt-2 flex flex-col gap-4 border-2 border-border p-6">
          <span className="sn-num">00 /</span>
          <p className="poster-3">
            {t("not.todo_1")}
            <br />
            {t("not.todo_2")}<span className="sn-hot">.</span>
          </p>
          <p className="body-sm">{t("not.vacio")}</p>
          <Link href="/" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full no-underline")}>
            {t("not.volver_inicio")} <span aria-hidden>↗</span>
          </Link>
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((n, i) => {
            const g = grupoDe(n.created_at, ahora);
            const nuevoGrupo = i === 0 || grupoDe(items[i - 1].created_at, ahora) !== g;
            const Icono = ICONOS[n.tipo] ?? Bell;
            return (
              <li key={n.id}>
                {nuevoGrupo ? (
                  <div className="p-sec">
                    <h2 className="sn-num">{t(TITULOS_GRUPO[g])}</h2>
                    {i === 0 ? <span className="sn-meta">{t("not.sin_leer_n", { n: sinLeer })}</span> : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => abrir(n)}
                  className="p-row w-full cursor-pointer border-0 border-b bg-transparent text-left"
                  aria-label={`${n.leida ? t("not.leida") : t("not.sin_leer")}: ${n.titulo}`}
                >
                  <span className={cn("p-row__i", !n.leida && "bg-signal text-ink")}>
                    <Icono aria-hidden className="size-5" />
                  </span>
                  <span className="p-row__t">
                    <b className={cn("break-words", n.leida && "font-normal")}>{n.titulo}</b>
                    <span className="body-sm break-words text-text-muted">{n.cuerpo}</span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-2">
                    <span className="sn-meta">{etiquetaHora(n.created_at, ahora, idioma === "en" ? "en-US" : "es-CO")}</span>
                    <span aria-hidden className={cn("size-3 border-2", n.leida ? "border-border-subtle" : "border-border bg-signal")} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
