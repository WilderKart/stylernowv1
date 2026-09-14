import { cn } from "@/lib/utils";
import * as React from "react";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-subtle bg-surface p-4",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "danger" | "accent" }) {
  const tones = {
    neutral: "bg-surface-2 text-text-muted",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    accent: "bg-accent-soft text-accent",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
