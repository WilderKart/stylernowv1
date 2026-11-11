import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { EmptyState, Num } from "@/components/brutal";
import { NegocioCard } from "@/components/marketplace/negocio-card";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
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
    <div className="flex min-h-dvh flex-col bg-bg pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))]">
      <Header autenticado etiqueta="04 / Favoritos" />
      <main className="mx-auto w-full max-w-5xl flex-1">
        <h1 className="poster-1 px-4 pb-4 pt-3 sm:px-6">
          Tus
          <br />
          <span className="sn-hot">fijos.</span>
        </h1>
        <div className="p-sec sm:!px-6">
          <Num>01 / Negocios</Num>
        </div>
        {negocios.length === 0 ? (
          <div className="px-4 sm:px-6">
            <EmptyState
              big="0"
              title="Todavía no guardaste ningún negocio"
              hint="Tocá el corazón en el perfil de un negocio para guardarlo acá y encontrarlo rápido después."
              action={
                <Link href="/" className="sn-chip !min-h-12 no-underline">
                  Explorar negocios ↗
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {negocios.map((n, i) => (
              <NegocioCard key={n.id} negocio={n} index={i + 1} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
