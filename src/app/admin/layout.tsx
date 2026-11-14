import { requireSuperSU } from "@/lib/auth/require-supersu";
import { createClient } from "@/lib/supabase/server";
import { BarraLateralAdmin } from "./barra-lateral";
import { contadoresAdmin } from "./tablero";
import { Suspense } from "react";
import CargandoAdmin from "./loading";

export const metadata = { title: "Super Admin" };

/**
 * El guard (`await requireSuperSU()`) vive en un componente propio envuelto
 * en un `<Suspense>` local — NO directo en `AdminLayout` — porque `loading.tsx`
 * de un segmento nunca envuelve el `layout.tsx` de ese mismo segmento (solo su
 * `page.tsx` y layouts anidados; ver node_modules/next/dist/docs/.../loading.md).
 * Sin este boundary local, la única Suspense boundary por encima de este guard
 * async es la de `src/app/loading.tsx` (el skeleton del Marketplace), que es
 * exactamente lo que se ve pintado en `/admin` mientras el guard resuelve.
 *
 * Diseño (2026-11-14): barra lateral vertical negra en escritorio; en móvil, barra superior + menú deslizable.
 */
async function AdminGuardado({ children }: { children: React.ReactNode }) {
  const { nombre } = await requireSuperSU();
  const supabase = await createClient();
  const [{ data: { user } }, contadores] = await Promise.all([supabase.auth.getUser(), contadoresAdmin()]);
  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:flex-row">
      <BarraLateralAdmin email={user?.email ?? ""} nombre={nombre ?? ""} contadores={contadores} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
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
