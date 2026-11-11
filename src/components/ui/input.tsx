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
          <label htmlFor={inputId} className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase">
            {label}
          </label>
        ) : null}
        <div className="relative flex items-center">
          {leadingIcon ? <span className="absolute left-4 text-text-faint">{leadingIcon}</span> : null}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "min-h-12 w-full min-w-0 border-2 border-border bg-bg px-3 text-[15px] leading-[22px] text-text",
              "placeholder:text-text-muted outline-none focus:shadow-hard",
              "disabled:border-dashed disabled:border-text-disabled disabled:bg-surface disabled:text-text-disabled",
              leadingIcon && "pl-11",
              error && "border-danger shadow-[4px_4px_0_0_var(--danger)]",
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <span role="alert" className="self-start bg-danger px-1.5 py-0.5 font-mono text-[11px] leading-[14px] tracking-[0.66px] text-ink uppercase">
            {error}
          </span>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
