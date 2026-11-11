import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: Plan y facturación. */
export default function CargandoSuscripcion() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8" aria-busy="true">
      <Skeleton className="mb-3 h-10 w-3/4" />
      <Skeleton className="mb-6 h-4 w-1/2" />
      <Skeleton className="mb-6 h-44 w-full" />
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="mb-3 h-5 w-32" />
      <Skeleton className="mb-3 h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </main>
  );
}
