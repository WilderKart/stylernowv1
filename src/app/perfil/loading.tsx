import { Skeleton } from "@/components/ui/skeleton";

/** ADR-012 — Skeleton obligatorio: Perfil (Cliente). */
export default function CargandoPerfil() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
