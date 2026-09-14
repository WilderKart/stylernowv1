import { cn } from "@/lib/utils";

/** Rating agregado. Toda reseña proviene de una Reserva COMPLETADA (02-UX/04_Marketplace.md). */
export function Rating({
  valor,
  total,
  className,
  size = "sm",
}: {
  valor: number;
  total?: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const sinResenas = !total || total === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        size === "sm" ? "text-[11.5px]" : "text-[13px]",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width={size === "sm" ? 12 : 14}
        height={size === "sm" ? 12 : 14}
        aria-hidden="true"
        className={sinResenas ? "fill-text-faint" : "fill-accent"}
      >
        <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />
      </svg>
      {sinResenas ? (
        <span className="text-text-faint">Sin reseñas</span>
      ) : (
        <>
          <span className="font-bold text-text">{valor.toFixed(1)}</span>
          <span className="text-text-faint">({total})</span>
        </>
      )}
    </span>
  );
}
