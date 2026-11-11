import { ScreenHeader } from "@/components/brutal";
import { contarNoLeidas } from "@/lib/cliente/notificaciones";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export function Logo() {
  return (
    <span className="sn-header__title" aria-label="StylerNow">
      Styler<span className="sn-hot">Now</span>
    </span>
  );
}

function Campana({ cantidad }: { cantidad: number }) {
  const texto = cantidad > 99 ? "99+" : String(cantidad);
  return (
    <Link
      href="/notificaciones"
      className="sn-iconbtn relative"
      aria-label={cantidad > 0 ? `Avisos, ${cantidad} sin leer` : "Avisos"}
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
async function CampanaConContador() {
  const r = await contarNoLeidas();
  return <Campana cantidad={r.ok ? Number(r.data) || 0 : 0} />;
}

/**
 * Barra superior de las pantallas de "recorrido" (patrón .p-top): logo a la izquierda y
 * el acceso del Cliente a la derecha. La API pública no cambia.
 */
export function Header({ autenticado, etiqueta }: { autenticado: boolean; etiqueta?: string }) {
  return (
    <header className="p-top">
      <Link href="/" aria-label="Inicio" className="flex min-h-12 items-center pl-3 no-underline text-text">
        <Logo />
      </Link>
      {etiqueta ? <span className="sn-num hidden flex-1 text-center sm:block">{etiqueta}</span> : <span className="flex-1" />}
      {autenticado ? (
        <>
          <Suspense fallback={<Campana cantidad={0} />}>
            <CampanaConContador />
          </Suspense>
          <Link href="/mis-reservas" className="sn-label flex min-h-12 items-center px-3 text-text no-underline">
            Mis reservas ↗
          </Link>
        </>
      ) : (
        <Link href="/login" className="sn-label flex min-h-12 items-center border-2 border-border px-4 text-text no-underline">
          Iniciar sesión
        </Link>
      )}
    </header>
  );
}

/** Barra de pantallas internas: una sola acción de retroceso, sin competir con el CTA. */
export function BarraSuperior({ titulo, volverA }: { titulo: string; volverA: string }) {
  return <ScreenHeader title={titulo} back={volverA} className="sticky top-0 z-20" />;
}
