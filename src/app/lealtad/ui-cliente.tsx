import { EnlaceVolver, EstadoReservaStatus, PantallaCargandoCliente, VerDetalle } from "./ui-cliente-t";
import { cn } from "@/lib/utils";
import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/**
 * Piezas visuales compartidas de las pantallas de Cliente (reserva, pago, perfil, lealtad,
 * gift cards, membresías). Reproducen los patrones del prototipo (.p-top, .p-sec, .p-row,
 * .p-foot, .sn-ticket) sin tocar src/components/brutal. Son server-safe (sin estado).
 */

/** Contenedor de pantalla: columna fluida, centrada en pantallas anchas. */
export function Pantalla({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto flex min-h-dvh w-full max-w-xl flex-1 flex-col bg-bg", className)} {...props} />;
}

/** Barra superior del prototipo (.p-top): volver + título mono en numeración editorial. */
export function Top({ titulo, volverA, derecha }: { titulo: string; volverA?: string; derecha?: React.ReactNode }) {
  return (
    <div className="p-top">
      {volverA ? (
        <EnlaceVolver href={volverA} />
      ) : (
        <span className="w-2" />
      )}
      <h2 className="sn-num min-w-0 flex-1 truncate">{titulo}</h2>
      <span className="p-top__r">{derecha}</span>
    </div>
  );
}

/** Título de sección numerado (.p-sec). */
export function Sec({ children, derecha }: { children: React.ReactNode; derecha?: React.ReactNode }) {
  return (
    <div className="p-sec">
      <h2 className="sn-num">{children}</h2>
      {derecha}
    </div>
  );
}

/** Fila de lista (.p-row). Con `href` es enlace; con `onClick` es botón; si no, es informativa. */
export function Fila({
  icono,
  titulo,
  meta,
  derecha,
  href,
  onClick,
  disabled,
  peligro,
  external,
}: {
  icono?: React.ReactNode;
  titulo: React.ReactNode;
  meta?: React.ReactNode;
  derecha?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  peligro?: boolean;
  external?: boolean;
}) {
  const interior = (
    <>
      {icono ? <span className="p-row__i">{icono}</span> : null}
      <span className="p-row__t">
        <b className={cn("break-words", peligro && "text-danger")}>{titulo}</b>
        {meta ? <span className="sn-meta break-words">{meta}</span> : null}
      </span>
      <span className="p-row__r">{derecha ?? (href || onClick ? <ChevronRight aria-hidden className="size-5" /> : null)}</span>
    </>
  );
  if (href && external) {
    return (
      <a href={href} className="p-row">
        {interior}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className="p-row">
        {interior}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className="p-row w-full text-left disabled:opacity-50">
        {interior}
      </button>
    );
  }
  return <div className="p-row">{interior}</div>;
}

/** Lista de filas con borde superior grueso, como en el prototipo. */
export function Filas({ children }: { children: React.ReactNode }) {
  return <div className="border-t-2 border-border">{children}</div>;
}

/** Bloque informativo con numeración (.p-block), p. ej. "00 / Política". */
export function Bloque({ etiqueta, children, className }: { etiqueta?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("p-block border-b border-border-subtle", className)}>
      {etiqueta ? <span className="sn-num">{etiqueta}</span> : null}
      <div className={cn("body-sm break-words", etiqueta && "mt-1.5")}>{children}</div>
    </div>
  );
}

/** Pie fijo de acción (.p-foot). */
export function Pie({ children }: { children: React.ReactNode }) {
  return <div className="p-foot flex flex-col gap-3">{children}</div>;
}

/** Aviso de error accesible (.sn-help--error). */
export function ErrorAviso({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="sn-help sn-help--error break-words">
      <TriangleAlert aria-hidden />
      {children}
    </p>
  );
}

export { EstadoReservaStatus };
export type { EstadoReserva } from "./ui-cliente-t";

/** Día y mes cortos ("11", "NOV") en la zona horaria del negocio. */
export function diaYMes(iso: string, tz: string) {
  const f = new Intl.DateTimeFormat("es-CO", { timeZone: tz, day: "2-digit", month: "short" }).formatToParts(new Date(iso));
  const dia = f.find((p) => p.type === "day")?.value ?? "";
  const mes = (f.find((p) => p.type === "month")?.value ?? "").replace(".", "");
  return { dia, mes };
}

export function horaCorta(iso: string, tz: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/**
 * Ticket del prototipo (.sn-ticket) con estado arriba, título de póster y líneas meta.
 * Con `href` toda la tarjeta es un enlace con pie "Ver detalle ↗".
 */
export function TicketCita({
  dia,
  mes,
  estado,
  titulo,
  lineas,
  href,
  pie,
}: {
  dia: string;
  mes: string;
  estado?: React.ReactNode;
  titulo: React.ReactNode;
  lineas?: React.ReactNode[];
  href?: string;
  pie?: React.ReactNode;
}) {
  const cuerpo = (
    <>
      <div className="sn-ticket__top">
        <div className="sn-ticket__date">
          <span className="sn-meta">{mes}</span>
          <b>{dia}</b>
        </div>
        <div className="sn-ticket__main min-w-0">
          {estado}
          <h3 className="poster-5 break-words">{titulo}</h3>
          {lineas?.map((l, i) => (
            <span key={i} className="sn-meta break-words">
              {l}
            </span>
          ))}
        </div>
      </div>
      {href || pie ? (
        <>
          <div className="sn-ticket__perf" />
          <div className="sn-ticket__foot">
            {pie ?? (
              <>
                <VerDetalle />
                <span className="sn-label" aria-hidden>
                  ↗
                </span>
              </>
            )}
          </div>
        </>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className="sn-ticket block text-text no-underline">
      {cuerpo}
    </Link>
  ) : (
    <article className="sn-ticket">{cuerpo}</article>
  );
}

/** Barra de progreso del prototipo (.p-bar). `pct` 0–100. */
export function Barra({ pct, className, etiqueta }: { pct: number; className?: string; etiqueta?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("p-bar", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={etiqueta}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}

/** Esqueleto de carga estándar de las pantallas de Cliente (ADR-012). */
export function PantallaCargando({ filas = 4 }: { filas?: number }) {
  return <PantallaCargandoCliente filas={filas} />;
}
