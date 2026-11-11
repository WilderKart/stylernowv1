import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ink" | "ghost" | "danger" | "outline";
type ButtonSize = "md" | "lg" | "sm" | "icon";

// Sistema brutalista (prototipo, .sn-btn): borde 2px, esquinas 0, sombra dura
// que "se hunde" al presionar, tipografía mono en mayúsculas. Deshabilitado =
// borde punteado sin sombra.
const variants: Record<ButtonVariant, string> = {
  primary:
    "border-2 border-ink bg-signal text-ink shadow-hard active:translate-x-1 active:translate-y-1 active:bg-accent-hover active:shadow-none",
  secondary: "border-2 border-border bg-transparent text-text active:bg-text active:text-bg",
  ink: "border-2 border-ink bg-ink text-paper dark:border-border active:translate-x-1 active:translate-y-1",
  ghost: "text-text-muted hover:text-text active:bg-text active:text-bg",
  danger: "border-2 border-danger bg-transparent text-danger active:bg-danger active:text-ink",
  // Alias de "secondary" para componentes de shadcn/ui (ADR-012) que esperan
  // la variante "outline" por convención.
  outline: "border-2 border-border bg-transparent text-text active:bg-text active:text-bg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3",
  md: "min-h-12 px-4",
  lg: "min-h-12 px-4",
  icon: "size-10 p-0",
};

const base =
  "inline-flex items-center justify-center gap-3 font-mono text-xs leading-4 font-bold tracking-[0.72px] uppercase " +
  "transition-[transform,box-shadow] duration-100 ease-[cubic-bezier(0.2,0,0,1)] " +
  "disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:border-dashed disabled:border-text-disabled " +
  "disabled:bg-surface disabled:text-text-disabled disabled:shadow-none";

/** Genera las mismas clases que <Button> sin renderizar el elemento — para
 * componentes de shadcn/ui (ej. `calendar.tsx`) que necesitan aplicar el
 * estilo de botón a un elemento que no es un <button> de StylerNow. */
export function buttonVariants({ variant = "primary", size = "lg", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "lg", asChild, loading, disabled, children, ...props }, ref) => {
    const classes = cn(base, variants[variant], sizes[size], className);

    // Slot solo admite un único elemento hijo: delegamos children tal cual
    // y omitimos props de <button> que no aplican al elemento envuelto.
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button ref={ref} disabled={disabled || loading} className={classes} {...props}>
        {loading ? (
          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
