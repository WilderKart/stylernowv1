import { requireSuperSU } from "@/lib/auth/require-supersu";
import { AdminNav } from "./admin-nav";
import { Suspense } from "react";
import CargandoAdmin from "./loading";

export const metadata = { title: "SuperSU" };

/**
 * El guard (`await requireSuperSU()`) vive en un componente propio envuelto
 * en un `<Suspense>` local — NO directo en `AdminLayout` — porque `loading.tsx`
 * de un segmento nunca envuelve el `layout.tsx` de ese mismo segmento (solo su
 * `page.tsx` y layouts anidados; ver node_modules/next/dist/docs/.../loading.md).
 * Sin este boundary local, la única Suspense boundary por encima de este guard
 * async es la de `src/app/loading.tsx` (el skeleton del Marketplace), que es
 * exactamente lo que se ve pintado en `/admin` mientras el guard resuelve.
 */
async function AdminGuardado({ children }: { children: React.ReactNode }) {
  await requireSuperSU();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AdminNav />
      {children}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<CargandoAdmin />}>
      <AdminGuardado>{children}</AdminGuardado>
    </Suspense>
  );
}
