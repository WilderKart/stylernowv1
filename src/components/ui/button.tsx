import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "md" | "lg" | "sm" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-bg font-bold hover:bg-accent-hover disabled:opacity-50 disabled:hover:bg-accent",
  secondary:
    "border border-border text-text font-semibold hover:border-accent/50 disabled:opacity-50",
  ghost: "text-text-muted hover:text-text disabled:opacity-50",
  danger: "border border-danger/40 text-danger font-semibold hover:bg-danger-soft",
  // Alias de "secondary" para componentes de shadcn/ui (ADR-012) que esperan
  // la variante "outline" por convención — mismo estilo visual, un nombre
  // más para no reescribir cada componente instalado del registry.
  outline: "border border-border text-text font-semibold hover:border-accent/50 disabled:opacity-50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs rounded-lg",
  md: "h-12 px-5 text-sm rounded-xl",
  lg: "h-[54px] px-6 text-sm rounded-2xl",
  icon: "size-9 rounded-lg p-0",
};

/** Genera las mismas clases que <Button> sin renderizar el elemento — para
 * componentes de shadcn/ui (ej. `calendar.tsx`) que necesitan aplicar el
 * estilo de botón a un elemento que no es un <button> de StylerNow. */
export function buttonVariants({ variant = "primary", size = "lg", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn("inline-flex items-center justify-center gap-2 tracking-wide transition-colors disabled:cursor-not-allowed", variants[variant], sizes[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "lg", asChild, loading, disabled, children, ...props }, ref) => {
    const classes = cn(
      "inline-flex items-center justify-center gap-2 tracking-wide transition-colors",
      "disabled:cursor-not-allowed",
      variants[variant],
      sizes[size],
      className
    );

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
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
