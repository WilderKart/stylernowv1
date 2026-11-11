import { BottomNav } from "@/components/layout/bottom-nav";
import { Fila, Filas, Pantalla, Sec, Top } from "@/app/lealtad/ui-cliente";
import { formatCOP } from "@/lib/utils";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Camera,
  CircleHelp,
  Gift,
  Globe,
  MapPin,
  Percent,
  Shield,
  Star,
  Ticket,
  UserCog,
  UserPlus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioPerfil } from "./formulario-perfil";
import { FotoPerfil } from "./foto-perfil";
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
      .select("nombre, telefono, email, avatar_url, fecha_nacimiento, categorias_interes, password_establecida")
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

      <div className="flex flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="poster-3 break-words">{nombre}</p>
          <span className="sn-meta break-all">{perfil?.email ?? user.email}</span>
        </div>
        <FotoPerfil nombre={nombre} avatarUrl={perfil?.avatar_url ?? null} />
      </div>

      <section aria-label="Lealtad" className="sn-block-signal m-4 border-2 border-ink shadow-[var(--sn-shadow-hard)]">
        <Link href="/lealtad" className="flex min-h-12 items-center justify-between gap-3 p-4 text-ink no-underline">
          <div className="min-w-0">
            <span className="sn-label">Lealtad</span>
            <p className="poster-3 break-words">Tus puntos y recompensas</p>
          </div>
          <ArrowUpRight aria-hidden className="size-6 shrink-0" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter" />
        </Link>
        {/* Puntos y saldo sobre fondo blanco; el resto del bloque queda naranja. */}
        <div className="grid grid-cols-2 border-t-2 border-ink bg-paper text-ink">
          <div className="min-w-0 border-r-2 border-ink p-4">
            <span className="sn-meta">Puntos</span>
            <div className="sn-fig text-2xl">{totalPuntos}</div>
          </div>
          <div className="min-w-0 p-4">
            <span className="sn-meta">Saldo</span>
            <div className="sn-fig truncate text-2xl">{formatCOP(saldo)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t-2 border-ink">
          <Link href="/gift-cards" className="flex min-h-12 items-center justify-center border-r-2 border-ink p-2 text-center text-ink no-underline sn-label">Gift cards</Link>
          <Link href="/membresias" className="flex min-h-12 items-center justify-center p-2 text-center text-ink no-underline sn-label">Membresías</Link>
        </div>
      </section>

      <div className="sn-gridcols grid-cols-1 border-b-2 border-border">
        <Link href="/mis-reservas" className="min-w-0 text-text no-underline">
          <span className="sn-meta">Citas</span>
          <div className="sn-fig text-2xl">{totalCitas ?? 0}</div>
        </Link>
      </div>

      <Sec>01 / Lo tuyo</Sec>
      <Filas>
        <Fila icono={<CalendarDays aria-hidden className="size-5" />} titulo="Mis citas" meta="Próximas, pasadas y canceladas" href="/mis-reservas" />
        <Fila icono={<Star aria-hidden className="size-5" />} titulo="Mi lealtad" meta="Puntos, wallet y referidos" href="/lealtad" />
        <Fila icono={<Ticket aria-hidden className="size-5" />} titulo="Mis membresías" meta="Planes activos y uso" href="/membresias" />
        <Fila icono={<Gift aria-hidden className="size-5" />} titulo="Gift cards" meta="Compra, regala y consulta" href="/gift-cards" />
      </Filas>

      <Sec>02 / Ajustes</Sec>
      <Filas>
        <Fila icono={<Bell aria-hidden className="size-5" />} titulo="Notificaciones" meta="Avisos de tus citas y novedades" href="/notificaciones" />
        <Fila icono={<Camera aria-hidden className="size-5" />} titulo="Mi Look" meta="Tus fotos de antes y después" href="/mi-look" />
        <Fila icono={<Wallet aria-hidden className="size-5" />} titulo="Pagos y saldo" meta="Historial y devolución de saldo" href="/pagos" />
        <Fila icono={<UserPlus aria-hidden className="size-5" />} titulo="Referidos" meta="Invita y gana saldo" href="/referidos" />
        <Fila icono={<Percent aria-hidden className="size-5" />} titulo="Ofertas" meta="Promociones cerca de ti" href="/ofertas" />
        <Fila icono={<Globe aria-hidden className="size-5" />} titulo="Idioma y región" meta="País, idioma y moneda" href="/ajustes/idioma-region" />
        <Fila icono={<MapPin aria-hidden className="size-5" />} titulo="Permisos" meta="Ubicación, notificaciones y más" href="/ajustes/permisos" />
        <Fila icono={<Shield aria-hidden className="size-5" />} titulo="Privacidad" meta="Tus datos y consentimientos" href="/privacidad" />
        <Fila icono={<CircleHelp aria-hidden className="size-5" />} titulo="Ayuda" meta="Preguntas frecuentes y soporte" href="/ayuda" />
        <Fila icono={<UserCog aria-hidden className="size-5" />} titulo="Cuenta" meta="Descargar o eliminar tu cuenta" href="/cuenta" />
      </Filas>

      <Sec>03 / Tus datos</Sec>
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
