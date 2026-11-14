import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: Panel SuperSU. */
export default function CargandoAdmin() {
  return (
    <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <Skeleton className="mb-6 h-6 w-32" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
