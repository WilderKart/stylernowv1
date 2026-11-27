/** Insignia azul de «negocio verificado», sin interacción (para tarjetas, donde todo el bloque ya es un enlace). */
export function InsigniaEstatica({ etiqueta, className = "" }: { etiqueta: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- icono pequeño propio de la plataforma
    <img
      src="/images/insignia-verificado.png"
      alt={etiqueta}
      title={etiqueta}
      width={20}
      height={20}
      className={`ml-1 inline-block size-[0.8em] min-h-4 min-w-4 align-[-0.08em] ${className}`}
    />
  );
}
