import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { PRESETS, type Rango } from "./rango";

/** Selector de periodo: atajos + rango personalizado (formulario GET, funciona sin JavaScript). */
export function SelectorFechas({ ruta, rango }: { ruta: string; rango: Rango }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 font-mono text-[11.5px] font-bold uppercase text-text">
        <CalendarDays className="size-4" aria-hidden />
        {rango.etiqueta}
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PRESETS.map((p) => (
          <Link
            key={p.clave}
            href={`${ruta}?rango=${p.clave}`}
            className={`shrink-0 border-2 px-2.5 py-1.5 text-[12px] font-semibold ${
              rango.clave === p.clave ? "border-accent bg-accent text-white" : "border-border text-text hover:border-accent"
            }`}
          >
            {p.etiqueta}
          </Link>
        ))}
      </div>
      <form action={ruta} className="flex flex-wrap items-end gap-1.5">
        <input type="hidden" name="rango" value="personalizado" />
        <label className="flex flex-col text-[10.5px] font-bold uppercase text-text-faint">
          Desde
          <input type="date" name="desde" defaultValue={rango.desdeTexto} required className="mt-0.5 h-9 border-2 border-border bg-bg px-2 text-[13px] text-text" />
        </label>
        <label className="flex flex-col text-[10.5px] font-bold uppercase text-text-faint">
          Hasta
          <input type="date" name="hasta" defaultValue={rango.hastaTexto} required className="mt-0.5 h-9 border-2 border-border bg-bg px-2 text-[13px] text-text" />
        </label>
        <button
          type="submit"
          className={`h-9 border-2 px-3 font-mono text-[11px] font-bold uppercase ${
            rango.clave === "personalizado" ? "border-accent bg-accent text-white" : "border-border bg-text text-bg hover:bg-accent"
          }`}
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}
