import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: App Staff. */
export default function CargandoStaff() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <Skeleton className="mb-6 h-6 w-32" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </main>
  );
}
