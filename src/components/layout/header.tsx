import { ScreenHeader } from "@/components/brutal";
import Link from "next/link";

export function Logo() {
  return (
    <span className="sn-header__title" aria-label="StylerNow">
      Styler<span className="sn-hot">Now</span>
    </span>
  );
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
        <Link href="/mis-reservas" className="sn-label flex min-h-12 items-center px-3 text-text no-underline">
          Mis reservas ↗
        </Link>
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
