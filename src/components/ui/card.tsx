import { cn } from "@/lib/utils";
import * as React from "react";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-2 border-border bg-bg p-4",
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
    neutral: "border-2 border-border bg-bg text-text",
    success: "bg-success text-ink",
    danger: "bg-danger text-ink",
    accent: "bg-signal text-ink",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[11px] leading-[14px] font-bold tracking-[0.66px] uppercase",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
