import { cn } from "@/lib/utils";

/**
 * shadcn/ui `skeleton` (ADR-012) — restyleado a los tokens de StylerNow:
 * `bg-accent-soft` del template original es el ámbar de marca acá, no un
 * neutro — un skeleton en ámbar se vería como un error visual, no una
 * carga. Se usa `bg-surface-2` (el mismo tono neutro que el resto del
 * proyecto usa para placeholders, ver `negocio-card.tsx`/loading states).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-surface-2", className)} {...props} />;
}

export { Skeleton };
