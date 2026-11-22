import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/** Piezas visuales comunes del Super Admin (estilo brutalista: borde negro duro y franja naranja). */

export function Caja({
  children,
  className = "",
  destacada = false,
}: {
  children: React.ReactNode;
  className?: string;
  destacada?: boolean;
}) {
  return (
    <section className={`min-w-0 border-2 border-border bg-app ${destacada ? "border-l-[6px] border-l-accent" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function TituloCaja({ children, href, extra }: { children: React.ReactNode; href?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
      <h2 className="font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-text">{children}</h2>
      <div className="flex items-center gap-3">
        {extra}
        {href && (
          <Link href={href} className="grid size-8 place-items-center text-text hover:text-accent" aria-label="Ver detalle">
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

export function Kpi({
  icono: Icono,
  etiqueta,
  valor,
  nota,
  href,
  destacada,
}: {
  icono: React.ComponentType<{ className?: string }>;
  etiqueta: string;
  valor: string;
  nota?: string;
  href?: string;
  destacada?: boolean;
}) {
  const clase = `group flex min-w-0 flex-col justify-between gap-3 border-2 border-border bg-app p-4 sm:p-5 ${
    destacada ? "border-l-[6px] border-l-accent" : ""
  } ${href ? "transition-shadow hover:shadow-[4px_4px_0_0_var(--shadow-ink)]" : ""}`;
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <Icono className="size-5 shrink-0 text-text" aria-hidden />
          <span className="font-mono text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-text">{etiqueta}</span>
        </span>
        {href && <ArrowUpRight className="size-4 shrink-0 text-text-faint group-hover:text-accent" aria-hidden />}
      </div>
      <div>
        <p className="font-display truncate text-[24px] font-black leading-none text-text sm:text-[30px]">{valor}</p>
        {nota && <p className="mt-1.5 text-[11.5px] font-semibold text-text-muted">{nota}</p>}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className={clase}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

/** Insignia de estado (texto en mono, borde duro). */
export function Insignia({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "acento" | "ok" | "alerta" | "peligro" }) {
  const tonos = {
    neutro: "border-border text-text",
    acento: "border-accent bg-accent text-white",
    ok: "border-success bg-success-soft text-text",
    alerta: "border-warning bg-warning/20 text-text",
    peligro: "border-danger bg-danger-soft text-danger",
  } as const;
  return (
    <span className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wide ${tonos[tono]}`}>
      {children}
    </span>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-[13px] text-text-faint">{children}</p>;
}

/** Barras verticales simples (CSS) para series diarias. */
export function GraficaBarras({
  serie,
  claves,
}: {
  serie: { etiqueta: string; titulo: string; valores: number[] }[];
  claves: { nombre: string; color: string }[];
}) {
  const maxReal = Math.max(0, ...serie.flatMap((d) => d.valores));
  const paso = Math.max(1, Math.ceil(maxReal / 4));
  const max = paso * 4;
  const cada = serie.length > 31 ? 7 : serie.length > 14 ? 3 : 1;
  return (
    <div className="px-4 pb-4 pt-4 sm:px-5">
      <div className="mb-3 flex flex-wrap gap-3 text-[11.5px] text-text-muted">
        {claves.map((c) => (
          <span key={c.nombre} className="flex items-center gap-1.5">
            <span className={`size-2.5 ${c.color}`} aria-hidden /> {c.nombre}
          </span>
        ))}
      </div>
      <div className="flex gap-2" role="img" aria-label={`Serie de ${serie.length} días`}>
        <div className="flex h-44 flex-col justify-between pb-6 text-right font-mono text-[10px] text-text-faint" aria-hidden>
          {[4, 3, 2, 1, 0].map((k) => (
            <span key={k}>{k * paso}</span>
          ))}
        </div>
        <div className="grid flex-1 items-end gap-[2px] sm:gap-1" style={{ gridTemplateColumns: `repeat(${serie.length}, minmax(0, 1fr))` }}>
          {serie.map((d, i) => (
            <div key={i} className="flex h-44 min-w-0 flex-col items-center justify-end gap-1" title={d.titulo}>
              <div className="flex h-full w-full items-end justify-center gap-px">
                {d.valores.map((v, j) => (
                  <span key={j} className={`w-full max-w-4 ${claves[j]?.color ?? "bg-accent"}`} style={{ height: `${(v / max) * 100}%` }} />
                ))}
              </div>
              <span className={`h-5 font-mono text-[9.5px] text-text-faint ${i % cada === 0 ? "" : "invisible"}`}>{d.etiqueta}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
