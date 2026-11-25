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
          <label htmlFor={inputId} className="text-[13px] leading-4 font-semibold text-text">
            {label}
          </label>
        ) : null}
        <div className="relative flex items-center">
          {leadingIcon ? <span className="absolute left-4 text-text-faint">{leadingIcon}</span> : null}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "min-h-12 w-full min-w-0 rounded-[14px] border border-line-input bg-bg px-4 text-[15px] leading-[22px] text-text",
              "placeholder:text-text-faint outline-none focus:border-signal focus:ring-4 focus:ring-signal/20",
              "disabled:border-border disabled:bg-surface disabled:text-text-disabled",
              leadingIcon && "pl-11",
              error && "border-danger focus:border-danger focus:ring-danger/20",
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <span role="alert" className="self-start rounded-full bg-danger/10 px-2.5 py-1 text-[12px] leading-[14px] font-medium text-danger">
            {error}
          </span>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
