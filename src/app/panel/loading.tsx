import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: Dashboard del Panel Negocio. */
export default function CargandoPanel() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <Skeleton className="mb-6 h-6 w-40" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mb-3 h-4 w-32" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </main>
  );
}
