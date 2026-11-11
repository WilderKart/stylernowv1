import { cn } from "@/lib/utils";
import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** Título de póster (condensado, 900, mayúsculas). `as` por defecto h2. */
export function Poster({
  as: Tag = "h2",
  size = 3,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" | "p" | "span"; size?: 1 | 2 | 3 | 4 | 5 }) {
  return <Tag className={cn(`poster-${size}`, className)} {...props} />;
}

/** Título de sección (expandido, 800, mayúsculas). */
export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("section", className)} {...props} />;
}

/** Etiqueta mono (12px) y meta (11px). */
export function Label({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("sn-label", className)} {...props} />;
}
export function Meta({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("sn-meta", className)} {...props} />;
}
/** Número editorial "01", "02"… */
export function Num({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("sn-num", className)} {...props} />;
}

/** Estado: ok / warn / err / info. */
export function Status({
  tone = "info",
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "ok" | "warn" | "err" | "info"; icon?: React.ReactNode }) {
  return (
    <span className={cn("sn-status", `sn-status--${tone}`, className)} {...props}>
      {icon}
      {children}
    </span>
  );
}

/** Nivel de profesional: PRO / EXPERT / MASTER. */
export function Tier({
  level,
  large,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { level: "pro" | "expert" | "master"; large?: boolean }) {
  return (
    <span className={cn("sn-tier", `sn-tier--${level}`, large && "sn-tier--lg", className)} {...props}>
      {children ?? level.toUpperCase()}
    </span>
  );
}

/** Chip de filtro. Para listas usar <ChipGroup> (baja de línea, nunca se corta). */
export function Chip({
  selected,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn("sn-chip", selected && "is-selected", className)}
      {...props}
    />
  );
}
export function ChipGroup({ className, ...props }: DivProps) {
  return <div className={cn("p-chips !px-0", className)} {...props} />;
}

/** Control segmentado (pestañas cortas tipo Día/Semana). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("sn-seg max-w-full flex-wrap", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Interruptor ON/OFF. */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn("sn-switch", className)}
      {...props}
    />
  );
}

/** Avatar circular con iniciales o imagen. `tier` dibuja el aro de nivel. */
export function Avatar({
  name,
  src,
  size = "md",
  tier,
  className,
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  tier?: "expert" | "master";
  className?: string;
}) {
  const iniciales = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn("sn-avatar", size !== "md" && `sn-avatar--${size}`, className)}
      data-tier={tier}
      role="img"
      aria-label={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar pequeño, URL de Storage ya optimizada
        <img src={src} alt="" className="size-full object-cover grayscale" />
      ) : (
        iniciales
      )}
    </span>
  );
}

/** Estrellas de solo lectura (0–5). */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("sn-stars", className)} role="img" aria-label={`${value.toFixed(1)} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={cn("lucide size-4", i + 0.5 > value ? "is-off" : "")}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="miter"
        >
          <polygon points="12 2 15.1 8.6 22 9.3 16.8 14.1 18.2 21 12 17.5 5.8 21 7.2 14.1 2 9.3 8.9 8.6" />
        </svg>
      ))}
    </span>
  );
}

/** Marquesina de texto (cinta animada). */
export function Marquee({
  text,
  tone = "ink",
  className,
}: {
  text: string;
  tone?: "ink" | "signal" | "plain";
  className?: string;
}) {
  const item = `${text} ✶ `;
  return (
    <div className={cn("sn-marquee", tone !== "plain" && `sn-marquee--${tone}`, className)} aria-hidden>
      {/* Velocidad constante y legible (~60 px/s): la duración crece con el largo del texto. */}
      <div className="sn-marquee__track" style={{ animationDuration: `${Math.max(45, Math.round(item.length * 1.6))}s` }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>{item.repeat(4)}</span>
        ))}
      </div>
    </div>
  );
}

/** Foto en B/N; si no hay imagen muestra el marcador del sistema. */
export function Photo({ src, alt = "", className }: { src?: string | null; alt?: string; className?: string }) {
  return (
    <div className={cn("sn-photo", className)} role={alt ? "img" : undefined} aria-label={alt || undefined}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- ver Avatar
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
    </div>
  );
}

/** Caja con borde del sistema (tarjeta genérica de contenido). */
export function Panel({ className, ...props }: DivProps) {
  return <div className={cn("p-card", className)} {...props} />;
}
