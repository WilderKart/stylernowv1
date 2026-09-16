import { Skeleton } from "@/components/ui/skeleton";

/**
 * ADR-012 — Skeleton obligatorio: Marketplace (Home, `/`).
 *
 * Vive en la raíz de `app/` porque el Home es literalmente `app/page.tsx`
 * (no hay un segmento `/marketplace` dedicado) — Next.js usa este mismo
 * archivo como fallback de CUALQUIER ruta sin su propio `loading.tsx` más
 * específico. Las 9 áreas obligatorias ya tienen la suya propia, así que
 * el único costo real es un destello breve de esta forma en rutas de un
 * solo propósito sin loading.tsx (login, favoritos, etc.) — aceptado como
 * trade-off razonable en vez de crear 10+ archivos genéricos solo para
 * evitarlo.
 */
export default function CargandoMarketplace() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 sm:px-10">
      <Skeleton className="mb-4 h-10 w-full rounded-2xl" />
      <div className="mb-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
