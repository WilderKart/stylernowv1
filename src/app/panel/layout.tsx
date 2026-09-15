import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/panel");

  return <div className="min-h-dvh bg-bg">{children}</div>;
}
