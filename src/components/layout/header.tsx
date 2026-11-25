import { ScreenHeader } from "@/components/brutal";
import { contarNoLeidas } from "@/lib/cliente/notificaciones";
import { Bell, User } from "lucide-react";
import { BotonTema } from "@/components/tema/tema-cliente";
import Link from "next/link";
import { Suspense } from "react";
import { obtenerT } from "@/lib/i18n/servidor";
import type { Traductor } from "@/lib/i18n/diccionario";
import h from "./header.module.css";
import { LogoStylerNow } from "./logo-stylernow";

export function Logo() {
  return <LogoStylerNow />;
}

function Campana({ cantidad, t }: { cantidad: number; t: Traductor }) {
  const texto = cantidad > 99 ? "99+" : String(cantidad);
  return (
    <Link
      href="/notificaciones"
      className="sn-iconbtn relative"
      aria-label={cantidad > 0 ? t("header.avisos_sin_leer", { n: cantidad }) : t("header.avisos")}
    >
      <Bell aria-hidden className="size-5" />
      {cantidad > 0 ? (
        <span
          aria-hidden
          className="absolute top-0.5 right-0 grid min-w-[18px] place-items-center rounded-full bg-signal px-1 text-[10px] font-bold leading-[18px] text-white"
        >
          {texto}
        </span>
      ) : null}
    </Link>
  );
}

/** Campana con contador de no leídos. Si la consulta falla, se muestra sin contador (nunca rompe la barra). */
async function CampanaConContador({ t }: { t: Traductor }) {
  const r = await contarNoLeidas();
  return <Campana cantidad={r.ok ? Number(r.data) || 0 : 0} t={t} />;
}

/**
 * Barra superior del recorrido del cliente (referencia de diseño): logo, enlaces principales, y a la derecha el acceso.
 * En móvil solo quedan logo, tema y acceso. La API pública no cambia.
 */
export async function Header({ autenticado }: { autenticado: boolean; etiqueta?: string }) {
  const t = await obtenerT();
  return (
    <header className={h.barra}>
      <div className={h.interior}>
        <Link href="/" aria-label={t("header.inicio")} className={h.logo}>
          <LogoStylerNow />
        </Link>
        <nav className={h.nav} aria-label={t("header.principal")}>
          <Link href="/">{t("header.explorar")}</Link>
          <Link href="/?todos=1">{t("header.negocios")}</Link>
          <Link href="/lealtad">{t("header.premios")}</Link>
          <Link href="/para-negocios">{t("header.para_negocios")}</Link>
        </nav>
        <div className={h.derecha}>
          <BotonTema className="sn-iconbtn !w-9 shrink-0" />
          {autenticado ? (
            <>
              <Suspense fallback={<Campana cantidad={0} t={t} />}>
                <CampanaConContador t={t} />
              </Suspense>
              <Link href="/mis-reservas" className={`${h.accion} ${h["solo-pc"]}`}>
                {t("header.mis_reservas")}
              </Link>
              <Link href="/perfil" className={h.avatar} aria-label={t("header.perfil")}>
                <User className="size-5" aria-hidden />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={`${h.accion} ${h["solo-pc"]}`}>
                {t("header.iniciar_sesion")}
              </Link>
              <Link href="/login" className={`${h.avatar} ${h["solo-movil"]}`} aria-label={t("header.iniciar_sesion")}>
                <User className="size-5" aria-hidden />
              </Link>
              <Link href="/registro" className={h.caja}>
                {t("header.crear_cuenta")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Barra de pantallas internas: una sola acción de retroceso, sin competir con el CTA. */
export function BarraSuperior({ titulo, volverA }: { titulo: string; volverA: string }) {
  return <ScreenHeader title={titulo} back={volverA} className="sticky top-0 z-20" />;
}
