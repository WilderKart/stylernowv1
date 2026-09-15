import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioPerfil } from "./formulario-perfil";

export const metadata = {
  title: "Mi perfil",
  robots: { index: false, follow: false },
};

export default async function PerfilPage(props: PageProps<"/perfil">) {
  const params = await props.searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/perfil");

  const [{ data: perfil }, { data: puntos }] = await Promise.all([
    supabase
      .from("perfil")
      .select("nombre, telefono, email, fecha_nacimiento, categorias_interes")
      .eq("id", user.id)
      .single(),
    supabase
      .from("punto_fidelizacion")
      .select("cantidad_disponible")
      .eq("cliente_id", user.id)
      .gt("cantidad_disponible", 0),
  ]);

  const totalPuntos = (puntos ?? []).reduce((a, p) => a + p.cantidad_disponible, 0);
  const bienvenida = params.bienvenida === "1" || !perfil?.telefono;

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-24">
      <Header autenticado />

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        <h1 className="font-display mb-5 text-[24px] font-bold uppercase text-text">
          Mi perfil
        </h1>

        <Card className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
              Puntos de fidelización
            </p>
            <p className="font-display mt-1 text-[22px] font-bold text-accent">
              {totalPuntos}
            </p>
          </div>
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="#e8a23c"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />
            </svg>
          </span>
        </Card>

        <FormularioPerfil
          nombreInicial={perfil?.nombre ?? ""}
          telefonoInicial={perfil?.telefono ?? ""}
          fechaNacimientoInicial={perfil?.fecha_nacimiento ?? ""}
          categoriasInicial={perfil?.categorias_interes ?? []}
          email={perfil?.email ?? user.email ?? ""}
          bienvenida={bienvenida}
        />
      </main>

      <BottomNav />
    </div>
  );
}
