import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { NegocioCard } from "@/components/marketplace/negocio-card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listarMisFavoritos } from "./actions";

export const metadata = { title: "Mis Favoritos" };

export default async function FavoritosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/favoritos");

  const negocios = await listarMisFavoritos();

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-24">
      <Header autenticado />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 sm:px-10">
        <h1 className="font-display mb-4 text-base font-semibold uppercase tracking-wide text-text">Mis Favoritos</h1>
        {negocios.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
            <p className="mb-1 text-sm font-semibold text-text">Todavía no guardaste ningún negocio</p>
            <p className="max-w-[300px] text-xs text-text-faint">
              Tocá el corazón en el perfil de un negocio para guardarlo acá y encontrarlo rápido después.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {negocios.map((n) => (
              <NegocioCard key={n.id} negocio={n} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
