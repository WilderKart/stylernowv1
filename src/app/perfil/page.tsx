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
import { obtenerT } from "@/lib/i18n/servidor";
import { FormularioPerfil } from "./formulario-perfil";
import { FotoPerfil } from "./foto-perfil";
import { CambiarContrasena } from "./cambiar-contrasena";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("perfil.meta"), robots: { index: false, follow: false } };
}

export default async function PerfilPage(props: PageProps<"/perfil">) {
  const params = await props.searchParams;
  const t = await obtenerT();
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

  const nombre = perfil?.nombre || t("perfil.tu_perfil");
  const saldo = Number(wallet?.saldo_disponible ?? 0);

  return (
    <Pantalla className="pb-24">
      <Top titulo={t("perfil.top")} />

      <div className="flex flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="poster-3 break-words">{nombre}</p>
          <span className="sn-meta break-all">{perfil?.email ?? user.email}</span>
        </div>
        <FotoPerfil nombre={nombre} avatarUrl={perfil?.avatar_url ?? null} />
      </div>

      <section aria-label={t("perfil.lealtad_aria")} className="sn-block-signal m-4 border-2 border-ink shadow-[var(--sn-shadow-hard)]">
        <Link href="/lealtad" className="flex min-h-12 items-center justify-between gap-3 p-4 text-ink no-underline">
          <div className="min-w-0">
            <span className="sn-label">{t("perfil.lealtad_aria")}</span>
            <p className="poster-3 break-words">{t("perfil.tus_puntos")}</p>
          </div>
          <ArrowUpRight aria-hidden className="size-6 shrink-0" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter" />
        </Link>
        {/* Puntos y saldo sobre fondo blanco; el resto del bloque queda naranja. */}
        <div className="grid grid-cols-2 border-t-2 border-ink bg-paper text-ink">
          <div className="min-w-0 border-r-2 border-ink p-4">
            <span className="sn-meta">{t("perfil.puntos")}</span>
            <div className="sn-fig text-2xl">{totalPuntos}</div>
          </div>
          <div className="min-w-0 p-4">
            <span className="sn-meta">{t("perfil.saldo")}</span>
            <div className="sn-fig truncate text-2xl">{formatCOP(saldo)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t-2 border-ink">
          <Link href="/gift-cards" className="flex min-h-12 items-center justify-center border-r-2 border-ink p-2 text-center text-ink no-underline sn-label">{t("perfil.gift_cards")}</Link>
          <Link href="/membresias" className="flex min-h-12 items-center justify-center p-2 text-center text-ink no-underline sn-label">{t("perfil.membresias")}</Link>
        </div>
      </section>

      <div className="sn-gridcols grid-cols-1 border-b-2 border-border">
        <Link href="/mis-reservas" className="min-w-0 text-text no-underline">
          <span className="sn-meta">{t("perfil.citas")}</span>
          <div className="sn-fig text-2xl">{totalCitas ?? 0}</div>
        </Link>
      </div>

      <Sec>{t("perfil.sec_lo_tuyo")}</Sec>
      <Filas>
        <Fila icono={<CalendarDays aria-hidden className="size-5" />} titulo={t("perfil.mis_citas")} meta={t("perfil.mis_citas_meta")} href="/mis-reservas" />
        <Fila icono={<Star aria-hidden className="size-5" />} titulo={t("perfil.mi_lealtad")} meta={t("perfil.mi_lealtad_meta")} href="/lealtad" />
        <Fila icono={<Ticket aria-hidden className="size-5" />} titulo={t("perfil.mis_membresias")} meta={t("perfil.mis_membresias_meta")} href="/membresias" />
        <Fila icono={<Gift aria-hidden className="size-5" />} titulo={t("perfil.gift_cards")} meta={t("perfil.gift_cards_meta")} href="/gift-cards" />
      </Filas>

      <Sec>{t("perfil.sec_ajustes")}</Sec>
      <Filas>
        <Fila icono={<Bell aria-hidden className="size-5" />} titulo={t("perfil.notificaciones")} meta={t("perfil.notificaciones_meta")} href="/notificaciones" />
        <Fila icono={<Camera aria-hidden className="size-5" />} titulo={t("perfil.mi_look")} meta={t("perfil.mi_look_meta")} href="/mi-look" />
        <Fila icono={<Wallet aria-hidden className="size-5" />} titulo={t("perfil.pagos")} meta={t("perfil.pagos_meta")} href="/pagos" />
        <Fila icono={<UserPlus aria-hidden className="size-5" />} titulo={t("perfil.referidos")} meta={t("perfil.referidos_meta")} href="/referidos" />
        <Fila icono={<Percent aria-hidden className="size-5" />} titulo={t("perfil.ofertas")} meta={t("perfil.ofertas_meta")} href="/ofertas" />
        <Fila icono={<Globe aria-hidden className="size-5" />} titulo={t("perfil.idioma")} meta={t("perfil.idioma_meta")} href="/ajustes/idioma-region" />
        <Fila icono={<MapPin aria-hidden className="size-5" />} titulo={t("perfil.permisos")} meta={t("perfil.permisos_meta")} href="/ajustes/permisos" />
        <Fila icono={<Shield aria-hidden className="size-5" />} titulo={t("perfil.privacidad")} meta={t("perfil.privacidad_meta")} href="/privacidad" />
        <Fila icono={<CircleHelp aria-hidden className="size-5" />} titulo={t("perfil.ayuda")} meta={t("perfil.ayuda_meta")} href="/ayuda" />
        <Fila icono={<UserCog aria-hidden className="size-5" />} titulo={t("perfil.cuenta")} meta={t("perfil.cuenta_meta")} href="/cuenta" />
      </Filas>

      <Sec>{t("perfil.sec_datos")}</Sec>
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
