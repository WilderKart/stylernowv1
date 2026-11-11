import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import * as React from "react";

/**
 * Casilla de consentimiento del prototipo (C14 / C17): cuadro de 28 px que se rellena de
 * naranja al marcarse. SIEMPRE se usa sin premarcar (el estado lo controla quien la monta).
 * Sin "use client": es presentacional; el estado vive en el padre.
 */
export function Casilla({
  checked,
  onChange,
  titulo,
  descripcion,
  etiqueta,
  caja,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  titulo?: React.ReactNode;
  descripcion: React.ReactNode;
  /** Mini etiqueta mono sobre el texto (p. ej. "OPCIONAL"). */
  etiqueta?: string;
  /** Con `true` el control va dentro de un recuadro con borde (C17). */
  caja?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "grid min-h-12 cursor-pointer grid-cols-[28px_1fr] items-start gap-3 py-2.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
        caja ? "border-2 border-border p-3" : "border-b border-border-subtle",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="grid size-7 place-items-center border-2 border-border text-ink peer-checked:bg-signal [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
      <span className="flex min-w-0 flex-col">
        {etiqueta ? <span className="sn-meta font-bold">{etiqueta}</span> : null}
        {titulo ? <span className="body font-bold break-words">{titulo}</span> : null}
        <span className="body-sm break-words text-text-muted">{descripcion}</span>
      </span>
    </label>
  );
}
