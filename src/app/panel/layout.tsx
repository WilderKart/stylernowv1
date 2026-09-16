import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CargandoPanel from "./loading";

export const metadata = {
  title: { template: "%s · Panel Negocio · StylerNow", default: "Panel Negocio" },
  robots: { index: false, follow: false },
};

/**
 * Guard de toda la superficie Panel Negocio (01-PRD/02_Functional_Architecture.md).
 * Cualquier usuario autenticado puede entrar — convertirse en "Barbería" es
 * simplemente crear un `negocio` propio, no un rol separado que haya que
 * activar antes (03-Business-Rules/01_Roles.md: una misma identidad puede ser
 * Cliente y Barbería a la vez).
 *
 * Vive en un componente propio envuelto en `<Suspense>` local — NO directo en
 * `PanelLayout` — porque `loading.tsx` de un segmento nunca envuelve el
 * `layout.tsx` de ese mismo segmento (ver node_modules/next/dist/docs/.../loading.md).
 * Sin este boundary local, la Suspense boundary que atrapa este guard async es
 * la de `src/app/loading.tsx` (el skeleton del Marketplace).
 */
async function PanelGuardado({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/panel");

  return <div className="min-h-dvh bg-bg">{children}</div>;
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<CargandoPanel />}>
      <PanelGuardado>{children}</PanelGuardado>
    </Suspense>
  );
}
