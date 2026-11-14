/**
 * Encabezado común de cada sección del Super Admin: miga en mono naranja + título en display.
 * `resaltado` pinta en naranja la última parte del título (como "CONTROL TOTAL DE LA PLATAFORMA.").
 */
export function EncabezadoAdmin({
  seccion,
  titulo,
  resaltado,
  descripcion,
  acciones,
}: {
  seccion: string;
  titulo: string;
  resaltado?: string;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-accent">/ {seccion}</p>
        <h1 className="font-display mt-1.5 text-[30px] font-black uppercase leading-[0.95] tracking-tight text-text sm:text-[40px]">
          {titulo}
          {resaltado && <span className="text-accent"> {resaltado}</span>}
        </h1>
        {descripcion && <p className="mt-2 max-w-2xl text-[13.5px] text-text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}
