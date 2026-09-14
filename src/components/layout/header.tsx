import Link from "next/link";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-7 items-center justify-center rounded-lg bg-accent">
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="#0A0A0A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="2.4" />
          <circle cx="6" cy="18" r="2.4" />
          <path d="M20 5 8.5 14M8.5 10 20 19" />
        </svg>
      </div>
      <span className="font-display text-[15px] font-bold text-text">STYLERNOW</span>
    </div>
  );
}

export function Header({ autenticado }: { autenticado: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border-subtle bg-bg/90 px-5 py-4 backdrop-blur sm:px-10">
      <Link href="/" aria-label="Inicio">
        <Logo />
      </Link>
      {autenticado ? (
        <Link
          href="/mis-reservas"
          className="text-xs font-semibold text-text-muted hover:text-text"
        >
          Mis reservas
        </Link>
      ) : (
        <Link
          href="/login"
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-text hover:border-accent/50"
        >
          Iniciar sesión
        </Link>
      )}
    </header>
  );
}

/** Barra de pantallas internas: una sola acción de retroceso, sin competir con el CTA. */
export function BarraSuperior({ titulo, volverA }: { titulo: string; volverA: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border-subtle bg-bg/90 px-5 py-4 backdrop-blur sm:px-10">
      <Link
        href={volverA}
        aria-label="Volver"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-accent/50 hover:text-text"
      >
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </Link>
      <h1 className="font-display truncate text-[15px] font-bold uppercase tracking-wide text-text">
        {titulo}
      </h1>
    </header>
  );
}
