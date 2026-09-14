import { cn } from "@/lib/utils";
import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leadingIcon, id, ...props }, ref) => {
    const idGenerado = React.useId();
    const inputId = id ?? idGenerado;
    return (
      <div className="flex flex-col gap-2">
        {label ? (
          <label htmlFor={inputId} className="text-[11.5px] font-bold tracking-wide text-text-muted uppercase">
            {label}
          </label>
        ) : null}
        <div className="relative flex items-center">
          {leadingIcon ? <span className="absolute left-4 text-text-faint">{leadingIcon}</span> : null}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "h-[52px] w-full rounded-[13px] border border-border bg-surface px-4 text-[14.5px] text-text",
              "placeholder:text-text-faint outline-none transition-colors focus:border-accent/60",
              leadingIcon && "pl-11",
              error && "border-danger/60",
              className
            )}
            {...props}
          />
        </div>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
    );
  }
);
Input.displayName = "Input";
