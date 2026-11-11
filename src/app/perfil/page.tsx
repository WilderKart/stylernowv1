import { BottomNav } from "@/components/layout/bottom-nav";
import { Avatar } from "@/components/brutal";
import { Fila, Filas, Pantalla, Sec, Top } from "@/app/lealtad/ui-cliente";
import { formatCOP } from "@/lib/utils";
import { CalendarDays, Gift, Star, Ticket } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioPerfil } from "./formulario-perfil";
import { CambiarContrasena } from "./cambiar-contrasena";

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

  const [{ data: perfil }, { data: puntos }, { count: totalCitas }, { data: wallet }] = await Promise.all([
    supabase
      .from("perfil")
      .select("nombre, telefono, email, fecha_nacimiento, categorias_interes, password_establecida")
      .eq("id", user.id)
      .single(),
    supabase
      .from("punto_fidelizacion")
      .select("cantidad_disponible")
      .eq("cliente_id", user.id)
      .gt("cantidad_disponible", 0),
    supabase.from("reserva").select("id", { count: "exact", head: true }),
    supabase.from("lealtad_wallet").select("saldo_disponible").eq("cliente_id", user.id).maybeSingle(),
  ]);

  const totalPuntos = (puntos ?? []).reduce((a, p) => a + p.cantidad_disponible, 0);
  const bienvenida = params.bienvenida === "1" || !perfil?.telefono;

  const nombre = perfil?.nombre || "Tu perfil";
  const saldo = Number(wallet?.saldo_disponible ?? 0);

  return (
    <Pantalla className="pb-24">
      <Top titulo="05 / Perfil" />

      <div className="flex items-center gap-4 p-4">
        <Avatar name={nombre} size="lg" />
        <div className="min-w-0">
          <p className="poster-3 break-words">{nombre}</p>
          <span className="sn-meta break-all">{perfil?.email ?? user.email}</span>
        </div>
      </div>

      <div className="sn-gridcols grid-cols-3 border-b-2 border-border">
        <Link href="/mis-reservas" className="min-w-0 text-text no-underline">
          <span className="sn-meta">Citas</span>
          <div className="sn-fig text-2xl">{totalCitas ?? 0}</div>
        </Link>
        <Link href="/lealtad" className="min-w-0 text-text no-underline">
          <span className="sn-meta">Puntos</span>
          <div className="sn-fig text-2xl">{totalPuntos}</div>
        </Link>
        <Link href="/lealtad" className="min-w-0 text-text no-underline">
          <span className="sn-meta">Saldo</span>
          <div className="sn-fig truncate text-2xl">{formatCOP(saldo)}</div>
        </Link>
      </div>

      <Sec>01 / Lo tuyo</Sec>
      <Filas>
        <Fila icono={<CalendarDays aria-hidden className="size-5" />} titulo="Mis citas" meta="Próximas, pasadas y canceladas" href="/mis-reservas" />
        <Fila icono={<Star aria-hidden className="size-5" />} titulo="Mi lealtad" meta="Puntos, wallet y referidos" href="/lealtad" />
        <Fila icono={<Ticket aria-hidden className="size-5" />} titulo="Mis membresías" meta="Planes activos y uso" href="/membresias" />
        <Fila icono={<Gift aria-hidden className="size-5" />} titulo="Gift cards" meta="Compra, regala y consulta" href="/gift-cards" />
      </Filas>

      <Sec>02 / Cuenta</Sec>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <CambiarContrasena passwordEstablecida={perfil?.password_establecida ?? false} />

        <FormularioPerfil
          nombreInicial={perfil?.nombre ?? ""}
          telefonoInicial={perfil?.telefono ?? ""}
          fechaNacimientoInicial={perfil?.fecha_nacimiento ?? ""}
          categoriasInicial={perfil?.categorias_interes ?? []}
          email={perfil?.email ?? user.email ?? ""}
          bienvenida={bienvenida}
        />
      </div>

      <BottomNav />
    </Pantalla>
  );
}
