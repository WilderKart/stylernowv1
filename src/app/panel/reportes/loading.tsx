import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: Reportes. */
export default function CargandoReportes() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <Skeleton className="mb-6 h-6 w-28" />
      <Skeleton className="mb-8 h-44 w-full rounded-2xl" />
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
