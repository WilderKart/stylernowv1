import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";

export const PASOS = ["Datos", "Ubicación", "Plan", "Confirmación"] as const;

/** Marca y rótulo de la pantalla (referencia visual del onboarding). */
export function Marca() {
  return (
    <header className="flex items-center gap-3 border-b-2 border-border px-5 py-3.5">
      <Link href="/" aria-label="StylerNow, ir al inicio" className="font-display text-[22px] font-bold uppercase leading-none text-text">
        STYLER<span className="text-accent">NOW</span>
      </Link>
      <span aria-hidden className="h-5 w-0.5 bg-border" />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.66px] text-text">Onboarding para negocios</span>
    </header>
  );
}

/** Indicador 01–04: hecho = marcado, actual = naranja con sombra dura, pendiente = contorno. */
export function IndicadorPasos({
  actual,
  maximo,
  onIr,
}: {
  actual: number;
  maximo: number;
  onIr: (paso: number) => void;
}) {
  return (
    <nav aria-label="Pasos del registro">
      <ol className="flex items-start">
        {PASOS.map((nombre, i) => {
          const n = i + 1;
          const hecho = n < actual;
          const esActual = n === actual;
          const alcanzable = n <= maximo && n !== actual;
          return (
            <li key={nombre} className="relative flex flex-1 flex-col items-center gap-1.5">
              {i > 0 ? (
                <span aria-hidden className={cn("absolute right-1/2 top-[17px] h-0.5 w-full", n <= actual ? "bg-ink dark:bg-text" : "bg-border-subtle")} />
              ) : null}
              <button
                type="button"
                disabled={!alcanzable}
                onClick={() => onIr(n)}
                aria-current={esActual ? "step" : undefined}
                aria-label={`Paso ${n}: ${nombre}${hecho ? " (completado)" : ""}`}
                className={cn(
                  "relative z-10 flex size-9 items-center justify-center border-2 font-mono text-[12px] font-bold",
                  esActual
                    ? "border-ink bg-signal text-ink shadow-hard-sm"
                    : hecho
                      ? "border-ink bg-bg text-text dark:border-text"
                      : "border-border bg-bg text-text-muted",
                  alcanzable ? "cursor-pointer" : "cursor-default",
                )}
              >
                {hecho ? <Check className="!size-4" aria-hidden /> : String(n).padStart(2, "0")}
              </button>
              <span className={cn("font-mono text-[9.5px] font-bold uppercase tracking-[0.5px]", esActual ? "text-accent" : "text-text-muted")}>
                {nombre}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Titular de paso: la parte `acento` va en naranja (referencia). */
export function TituloPaso({ inicio, acento, texto }: { inicio: string; acento: string; texto: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-[clamp(28px,9vw,40px)] font-bold uppercase leading-[0.95] text-text">
        {inicio} <span className="text-accent">{acento}</span>
      </h1>
      <p className="text-[14px] leading-relaxed text-text-muted">{texto}</p>
    </div>
  );
}
