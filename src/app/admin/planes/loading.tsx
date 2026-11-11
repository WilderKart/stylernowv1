import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: Planes y precios (SuperSU). */
export default function CargandoPlanes() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-10">
      <Skeleton className="mb-6 h-10 w-64" />
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-24" />
        ))}
      </div>
      <Skeleton className="mb-4 h-56 w-full" />
      <Skeleton className="h-72 w-full" />
    </main>
  );
}
