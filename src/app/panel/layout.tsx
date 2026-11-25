import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CargandoPanel from "./loading";
import { BannerSuscripcion } from "@/components/panel/banner-suscripcion";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { obtenerEstadoOperativo } from "@/lib/suscripcion/estado-operativo";
import { verticalDeCategorias } from "@/lib/tema/vertical";
import { terminologiaDe } from "@/lib/terminologia";
import { TerminologiaProvider } from "@/components/panel/terminologia-contexto";
import { categoriaRegistroDe } from "@/lib/auth/destino-inicial";
import { PanelSuaveProvider } from "@/components/panel/panel-estilo";

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

  // FASE 2B: aviso de suscripción restringida/gracia en TODO el panel. El estado lo decide la base (migración 164); aquí solo se muestra.
  const contexto = await resolverContexto();
  const estado = contexto.negocioId ? await obtenerEstadoOperativo(contexto.negocioId) : null;

  // Identidad visual única: el panel usa siempre el diseño original. Solo cambia la terminología (barbero, masajista…).
  let categorias: string[] | null = null;
  if (contexto.negocioId) {
    const { data: n } = await supabase.from("negocio").select("categoria").eq("id", contexto.negocioId).maybeSingle();
    categorias = n?.categoria ?? null;
  } else {
    categorias = [categoriaRegistroDe(user) ?? ""];
  }
  const vertical = verticalDeCategorias(categorias);
  const suave = vertical !== null;

  return (
    <PanelSuaveProvider suave={suave}>
      <TerminologiaProvider terminos={terminologiaDe(categorias)}>
      <div
        className={suave ? "min-h-dvh bg-app pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-[112px]" : "min-h-dvh bg-app pb-16 lg:pb-0 lg:pl-60"}
        data-vertical={vertical ?? undefined}
        data-panel={suave ? "suave" : undefined}
      >
        {estado ? <BannerSuscripcion estado={estado} puedePagar={contexto.rol === "BARBERIA"} /> : null}
        {children}
      </div>
      </TerminologiaProvider>
    </PanelSuaveProvider>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<CargandoPanel />}>
      <PanelGuardado>{children}</PanelGuardado>
    </Suspense>
  );
}
