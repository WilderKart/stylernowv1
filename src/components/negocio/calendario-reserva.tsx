"use client";

import { festivoDe } from "@/lib/calendario/festivos-colombia";
import { semanasDelMes, sumarMeses } from "@/lib/calendario/mes";
import { sumarDias } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

const CABECERA = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const etiquetaLarga = (f: string) => {
  const [a, m, d] = f.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d, 12)));
};

/**
 * Calendario mensual completo (lunes a domingo) del flujo de reserva. Solo pinta y navega: la disponibilidad real llega de la RPC
 * `slots_disponibles` (contada por día) y los límites (hoy, y hoy + max_anticipacion_dias del negocio) los fija el negocio, no esta pieza.
 * Los festivos nacionales son informativos: nunca bloquean por sí solos.
 */
export function CalendarioReserva({
  fecha,
  hoy,
  maxFecha,
  mes,
  onMes,
  onElegir,
  disponibilidad,
  cargando,
}: {
  fecha: string;
  hoy: string;
  maxFecha: string;
  /** "YYYY-MM" que se está mostrando. */
  mes: string;
  onMes: (ym: string) => void;
  onElegir: (fecha: string) => void;
  /** Horarios libres por día ("YYYY-MM-DD" → cantidad). null = aún no se sabe. */
  disponibilidad: Record<string, number> | null;
  cargando: boolean;
}) {
  const [selector, setSelector] = useState(false);
  const rejilla = useRef<HTMLDivElement>(null);
  const minMes = hoy.slice(0, 7);
  const maxMes = maxFecha.slice(0, 7);
  const [anio, numMes] = mes.split("-").map(Number);
  const anios = Array.from({ length: Number(maxMes.slice(0, 4)) - Number(minMes.slice(0, 4)) + 1 }, (_, i) => Number(minMes.slice(0, 4)) + i);
  const semanas = semanasDelMes(mes);

  const irA = (ym: string) => onMes(ym < minMes ? minMes : ym > maxMes ? maxMes : ym);

  function teclado(e: React.KeyboardEvent, f: string) {
    const salto = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (salto === undefined) return;
    e.preventDefault();
    let destino = sumarDias(f, salto);
    // Salta los días que no se pueden elegir; si no encuentra ninguno cerca, se queda.
    for (let i = 0; i < 40; i++) {
      const b = rejilla.current?.querySelector<HTMLButtonElement>(`[data-fecha="${destino}"]`);
      if (b && !b.disabled) return b.focus();
      if (!b) return;
      destino = sumarDias(destino, salto);
    }
  }

  return (
    <div className="border-2 border-ink bg-bg p-3 font-mono sm:p-4">
      {/* Mes y año */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => irA(sumarMeses(mes, -1))}
          disabled={mes <= minMes}
          aria-label="Mes anterior"
          className="grid size-11 flex-none place-items-center border-2 border-ink bg-bg text-ink disabled:cursor-not-allowed disabled:border-[var(--grid)] disabled:text-[var(--text-disabled)]"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setSelector((v) => !v)}
          aria-expanded={selector}
          aria-label={`${MESES[numMes - 1]} ${anio}: cambiar mes o año`}
          className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 text-[17px] font-bold tracking-wide text-ink uppercase"
        >
          <span className="truncate">
            {MESES[numMes - 1]} {anio}
          </span>
          <ChevronDown className={cn("size-4 flex-none transition-transform", selector && "rotate-180")} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => irA(sumarMeses(mes, 1))}
          disabled={mes >= maxMes}
          aria-label="Mes siguiente"
          className="grid size-11 flex-none place-items-center border-2 border-ink bg-bg text-ink disabled:cursor-not-allowed disabled:border-[var(--grid)] disabled:text-[var(--text-disabled)]"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      {selector ? (
        <div className="mt-3 grid grid-cols-2 gap-2 border-2 border-ink p-2">
          <label className="flex flex-col gap-1 text-[11px] font-bold tracking-wide uppercase">
            Mes
            <select
              value={numMes}
              onChange={(e) => irA(`${anio}-${String(e.target.value).padStart(2, "0")}`)}
              className="h-11 border-2 border-ink bg-bg px-2 text-[15px] normal-case"
            >
              {MESES.map((nombre, i) => {
                const ym = `${anio}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <option key={nombre} value={i + 1} disabled={ym < minMes || ym > maxMes}>
                    {nombre}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold tracking-wide uppercase">
            Año
            <select
              value={anio}
              onChange={(e) => irA(`${e.target.value}-${String(numMes).padStart(2, "0")}`)}
              className="h-11 border-2 border-ink bg-bg px-2 text-[15px]"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {/* Días de la semana */}
      <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold tracking-wide text-ink sm:text-[12px]" aria-hidden>
        {CABECERA.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      {/* Cuadrícula */}
      <div ref={rejilla} className="grid grid-cols-7 gap-y-1" role="grid" aria-label={`Calendario de ${MESES[numMes - 1]} ${anio}`} aria-busy={cargando}>
        {semanas.flat().map((d, i) => {
          const esDomingo = i % 7 === 6;
          const delMes = d.slice(0, 7) === mes;
          const enRango = d >= hoy && d <= maxFecha;
          const libres = disponibilidad?.[d];
          const sinDisp = enRango && libres === 0;
          const deshabilitado = !enRango || sinDisp;
          const elegido = d === fecha;
          const festivo = festivoDe(d);
          const dia = Number(d.slice(8));
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              data-fecha={d}
              disabled={deshabilitado && !elegido}
              aria-selected={elegido}
              aria-current={d === hoy ? "date" : undefined}
              aria-label={`${etiquetaLarga(d)}${festivo ? `, festivo nacional: ${festivo}` : ""}${
                !enRango ? ", fuera del período de reservas" : sinDisp ? ", sin disponibilidad" : libres ? `, ${libres} horarios libres` : ""
              }`}
              onClick={() => onElegir(d)}
              onKeyDown={(e) => teclado(e, d)}
              className={cn(
                "relative mx-auto flex h-12 w-full max-w-[56px] flex-col items-center justify-center gap-0.5 border-2 text-[16px] leading-none font-bold tabular-nums sm:h-14",
                elegido ? "border-ink bg-signal text-ink" : "border-transparent",
                !elegido && festivo && enRango && !sinDisp && "bg-[#dbeafe] text-[#1d4ed8]",
                !elegido && festivo && (!enRango || sinDisp) && "bg-[#eef2fb] text-[#8b9ccc]",
                !elegido && !festivo && esDomingo && enRango && !sinDisp && delMes && "text-[#c8102e]",
                !elegido && !festivo && deshabilitado && "text-[var(--text-disabled)]",
                !elegido && !festivo && !deshabilitado && !delMes && "text-[var(--text-faint)]",
                !elegido && !festivo && !deshabilitado && delMes && !esDomingo && "text-ink",
                !elegido && !deshabilitado && "hover:border-ink",
                "disabled:cursor-not-allowed"
              )}
            >
              <span className="flex items-center gap-1">
                {festivo ? <CalendarDays className="size-3.5" aria-hidden /> : null}
                {dia}
              </span>
              {/* Indicadores que no dependen solo del color: punto = hay horarios libres; raya = sin disponibilidad */}
              {libres && libres > 0 && !elegido ? <span className="size-1.5 rounded-full bg-signal" aria-hidden /> : null}
              {sinDisp && !elegido ? <span className="h-[2px] w-3 bg-[var(--text-disabled)]" aria-hidden /> : null}
              {elegido && festivo ? <span className="absolute top-0.5 right-0.5 size-1.5 bg-[#1d4ed8]" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <ul className="m-0 mt-3 flex list-none flex-wrap items-center gap-x-3 gap-y-1.5 p-0 text-[10.5px] font-bold tracking-wide text-ink uppercase sm:text-[11px]">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-signal" aria-hidden /> Disponible
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--text-disabled)]" aria-hidden /> Sin disponibilidad
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 bg-[#dbeafe]" aria-hidden /> Festivo
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 bg-[#c8102e]" aria-hidden /> Domingo
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#cfcfcf]" aria-hidden /> Otro mes
        </li>
      </ul>
      {cargando ? (
        <p className="sn-meta m-0 mt-2" role="status">
          Consultando disponibilidad…
        </p>
      ) : null}
    </div>
  );
}
