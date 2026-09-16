import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: CRM. */
export default function CargandoCrm() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <Skeleton className="mb-4 h-6 w-24" />
      <Skeleton className="mb-6 h-10 w-full rounded-xl" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
