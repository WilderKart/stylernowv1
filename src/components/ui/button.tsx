import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ink" | "ghost" | "danger" | "outline";
type ButtonSize = "md" | "lg" | "sm" | "icon";

// Diseño unificado (referencia iOS): píldora, azul de marca con sombra suave, sin bordes gruesos.
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-signal text-white shadow-[0_10px_22px_-10px_rgba(11,99,246,0.7)] hover:bg-accent-hover active:scale-[0.98] active:bg-accent-hover",
  secondary: "border border-border bg-bg text-text shadow-hard-sm hover:bg-surface active:scale-[0.98]",
  ink: "bg-text text-bg active:scale-[0.98]",
  ghost: "text-accent-text hover:bg-surface-2 active:bg-surface-2",
  danger: "border border-danger/40 bg-bg text-danger hover:bg-danger-soft active:scale-[0.98]",
  // Alias de "secondary" para componentes de shadcn/ui (ADR-012) que esperan la variante "outline" por convención.
  outline: "border border-border bg-bg text-text shadow-hard-sm hover:bg-surface active:scale-[0.98]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4",
  md: "min-h-12 px-5",
  lg: "min-h-12 px-5",
  icon: "size-10 p-0",
};

const base =
  "inline-flex items-center justify-center gap-3 rounded-full font-sans text-[15px] leading-5 font-semibold " +
  "transition-[transform,box-shadow,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] " +
  "disabled:cursor-not-allowed disabled:scale-100 disabled:border-transparent disabled:bg-surface-2 disabled:text-text-disabled disabled:shadow-none";

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
