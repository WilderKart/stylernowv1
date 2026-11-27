"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { guardarHorarioDelStaff } from "./horario-actions";

export interface TramoDia {
  dia: number; // 0 = domingo … 6 = sábado
  inicio: string; // HH:MM
  fin: string;
}
export interface SedeHorario {
  id: string;
  nombre: string;
}

// Se muestra de lunes a domingo; el valor es el día de la semana de la base (0 = domingo).
const ORDEN = [1, 2, 3, 4, 5, 6, 0];
const NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type Fila = { activo: boolean; inicio: string; fin: string };
const aFilas = (tramos: TramoDia[]): Fila[] =>
  Array.from({ length: 7 }, (_, d) => {
    const t = tramos.find((x) => x.dia === d);
    return { activo: Boolean(t), inicio: t?.inicio ?? "09:00", fin: t?.fin ?? "18:00" };
  });

/**
 * La barbería define el horario semanal de una persona del equipo, para cuando esa persona no lo configuró o no puede. Sin horario no hay
 * disponibilidad en la agenda del cliente. La base exige ser la propietaria y deja auditoría (migración 206).
 */
export function HorarioDelStaff({
  vinculoId,
  nombre,
  sedes,
  sedeInicial,
  porSede,
  serviciosAsignados,
}: {
  vinculoId: string;
  nombre: string;
  sedes: SedeHorario[];
  sedeInicial: string;
  porSede: Record<string, TramoDia[]>;
  /** null = no aplica (no se mide). */
  serviciosAsignados: number | null;
}) {
  const router = useRouter();
  const [sedeId, setSedeId] = useState(sedeInicial);
  const [guardado, setGuardado] = useState(porSede);
  const [filas, setFilas] = useState<Fila[]>(() => aFilas(porSede[sedeInicial] ?? []));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const diasGuardados = (guardado[sedeId] ?? []).length;
  const sinCambios = JSON.stringify(aFilas(guardado[sedeId] ?? [])) === JSON.stringify(filas);
  const hayActivos = filas.some((f) => f.activo);

  function cambiarSede(id: string) {
    setSedeId(id);
    setFilas(aFilas(guardado[id] ?? []));
    setError(null);
    setOk(false);
  }
  function editar(d: number, parche: Partial<Fila>) {
    setFilas((prev) => prev.map((f, i) => (i === d ? { ...f, ...parche } : f)));
    setOk(false);
  }
  function lunesAViernes() {
    setFilas((prev) => prev.map((f, d) => (d >= 1 && d <= 5 ? { activo: true, inicio: "09:00", fin: "18:00" } : { ...f, activo: false })));
    setOk(false);
  }
  function copiarATodos() {
    const base = filas.find((f) => f.activo);
    if (!base) return;
    setFilas((prev) => prev.map((f) => (f.activo ? { ...f, inicio: base.inicio, fin: base.fin } : f)));
    setOk(false);
  }

  async function guardar() {
    setError(null);
    setOk(false);
    const dias = filas.flatMap((f, d) => (f.activo ? [{ dia: d, inicio: f.inicio, fin: f.fin }] : []));
    if (dias.some((x) => x.fin <= x.inicio)) {
      setError("En cada día la hora de fin debe ser posterior a la de inicio.");
      return;
    }
    setOcupado(true);
    const r = await guardarHorarioDelStaff({ vinculoId, sedeId, dias });
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setGuardado((g) => ({ ...g, [sedeId]: dias }));
    setOk(true);
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-text">Horario de trabajo</p>
          <p className="mt-0.5 text-[12px] text-text-faint">
            {nombre} solo aparece con turnos libres en los días y horas que marques aquí. Puedes definirlo tú si no lo configuró.
          </p>
        </div>
        {sedes.length > 1 ? (
          <select value={sedeId} onChange={(e) => cambiarSede(e.target.value)} disabled={ocupado} aria-label="Sede" className="h-9 border-2 border-border bg-bg px-2 text-[12.5px]">
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {diasGuardados === 0 || serviciosAsignados === 0 ? (
        <div role="alert" className="mt-3 border-2 border-danger bg-danger-soft p-2.5 text-[12.5px] text-text">
          <b>{nombre} no aparece a los clientes todavía.</b>{" "}
          {diasGuardados === 0 ? "Falta definir su horario. " : null}
          {serviciosAsignados === 0 ? "Faltan servicios asignados (arriba, «Servicios que presta»)." : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={ocupado} onClick={lunesAViernes}>
          Lunes a viernes 9:00–18:00
        </Button>
        <Button size="sm" variant="secondary" disabled={ocupado || !hayActivos} onClick={copiarATodos}>
          Copiar el primer horario a los días activos
        </Button>
      </div>

      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {ORDEN.map((d) => {
          const f = filas[d];
          return (
            <li key={d} className="flex flex-wrap items-center gap-2 border-2 border-border px-3 py-2">
              <label className="flex w-28 shrink-0 items-center gap-2 text-[13px] font-semibold text-text">
                <input type="checkbox" checked={f.activo} disabled={ocupado} onChange={(e) => editar(d, { activo: e.target.checked })} />
                {NOMBRE[d]}
              </label>
              {f.activo ? (
                <>
                  <input type="time" value={f.inicio} disabled={ocupado} onChange={(e) => editar(d, { inicio: e.target.value })} aria-label={`Inicio ${NOMBRE[d]}`} className="h-9 border-2 border-border bg-bg px-2 text-[13px]" />
                  <span className="text-text-faint">—</span>
                  <input type="time" value={f.fin} disabled={ocupado} onChange={(e) => editar(d, { fin: e.target.value })} aria-label={`Fin ${NOMBRE[d]}`} className="h-9 border-2 border-border bg-bg px-2 text-[13px]" />
                </>
              ) : (
                <span className="text-[12px] text-text-faint">No trabaja</span>
              )}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="mt-3 mb-0 text-[12.5px] font-bold text-danger">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p role="status" className="mt-3 mb-0 text-[12.5px] font-bold text-success">
          Horario guardado. Ya se refleja en la agenda de los clientes.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" loading={ocupado} disabled={sinCambios} onClick={guardar}>
          Guardar horario
        </Button>
        <p className="m-0 text-[11.5px] text-text-faint">Si {nombre} había propuesto un cambio pendiente, este horario lo reemplaza.</p>
      </div>
    </Card>
  );
}
