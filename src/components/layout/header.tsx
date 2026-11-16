import { ScreenHeader } from "@/components/brutal";
import { contarNoLeidas } from "@/lib/cliente/notificaciones";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { obtenerT } from "@/lib/i18n/servidor";
import type { Traductor } from "@/lib/i18n/diccionario";
import h from "./header.module.css";

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
 * Barra superior de las pantallas de "recorrido" (maqueta 2026-11-15): logo grande a la izquierda,
 * separador vertical y el acceso del Cliente a la derecha. La API pública no cambia.
 */
export async function Header({ autenticado, etiqueta }: { autenticado: boolean; etiqueta?: string }) {
  const t = await obtenerT();
  return (
    <header className={h.barra}>
      <Link href="/" aria-label={t("header.inicio")} className={h.logo}>
        <span className={h.marca} aria-hidden>
          Styler<span className={h.now}>Now</span>
        </span>
      </Link>
      {etiqueta ? <span className={`sn-num hidden sm:block ${h.etiqueta}`}>{etiqueta}</span> : null}
      <span className={h.separador} aria-hidden />
      {autenticado ? (
        <>
          <Suspense fallback={<Campana cantidad={0} t={t} />}>
            <CampanaConContador t={t} />
          </Suspense>
          <Link href="/mis-reservas" className={h.accion}>
            {t("header.mis_reservas")}
          </Link>
        </>
      ) : (
        <>
          {/* Acceso visible al registro de negocios (antes solo existía la URL /para-negocios). */}
          <Link href="/para-negocios" className={`${h.accion} ${h.ancho}`}>
            {t("header.para_negocios")}
          </Link>
          <Link href="/login" className={h.accion}>
            {t("header.iniciar_sesion")}
          </Link>
          <Link href="/registro" className={`${h.accion} ${h.caja}`}>
            {t("header.crear_cuenta")}
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
