import { ScreenHeader } from "@/components/brutal";
import { contarNoLeidas } from "@/lib/cliente/notificaciones";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { obtenerT } from "@/lib/i18n/servidor";
import type { Traductor } from "@/lib/i18n/diccionario";

export function Logo() {
  return (
    <span className="sn-header__title" aria-label="StylerNow">
      Styler<span className="sn-hot">Now</span>
    </span>
  );
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
          className="sn-label absolute top-1.5 right-1 grid min-w-5 place-items-center border-2 border-ink bg-signal px-1 text-[10px] leading-4 text-ink"
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
 * Barra superior de las pantallas de "recorrido" (patrón .p-top): logo a la izquierda y
 * el acceso del Cliente a la derecha. La API pública no cambia.
 */
export async function Header({ autenticado, etiqueta }: { autenticado: boolean; etiqueta?: string }) {
  const t = await obtenerT();
  return (
    <header className="p-top">
      <Link href="/" aria-label={t("header.inicio")} className="flex min-h-12 items-center pl-3 no-underline text-text">
        <Logo />
      </Link>
      {etiqueta ? <span className="sn-num hidden flex-1 text-center sm:block">{etiqueta}</span> : <span className="flex-1" />}
      {autenticado ? (
        <>
          <Suspense fallback={<Campana cantidad={0} t={t} />}>
            <CampanaConContador t={t} />
          </Suspense>
          <Link href="/mis-reservas" className="sn-label flex min-h-12 items-center px-3 text-text no-underline">
            {t("header.mis_reservas")}
          </Link>
        </>
      ) : (
        <>
          {/* Acceso visible al registro de negocios (antes solo existía la URL /para-negocios). */}
          <Link href="/para-negocios" className="sn-label hidden min-h-12 items-center px-3 text-text no-underline sm:flex">
            {t("header.para_negocios")}
          </Link>
          <Link href="/login" className="sn-label flex min-h-12 items-center border-2 border-border px-4 text-text no-underline">
            {t("header.iniciar_sesion")}
          </Link>
        </>
      )}
    </header>
  );
}

/** Barra de pantallas internas: una sola acción de retroceso, sin competir con el CTA. */
export function BarraSuperior({ titulo, volverA }: { titulo: string; volverA: string }) {
  return <ScreenHeader title={titulo} back={volverA} className="sticky top-0 z-20" />;
}
