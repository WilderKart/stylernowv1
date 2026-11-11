import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: Mi Marca. */
export default function CargandoMarca() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-10">
      <Skeleton className="mb-6 h-10 w-56" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </main>
  );
}
