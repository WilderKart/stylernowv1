"use client";

import { crearSede, actualizarSede, type HorarioSemana } from "@/app/panel/sedes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const DIAS: { clave: keyof HorarioSemana; etiqueta: string }[] = [
  { clave: "lun", etiqueta: "Lunes" },
  { clave: "mar", etiqueta: "Martes" },
  { clave: "mie", etiqueta: "Miércoles" },
  { clave: "jue", etiqueta: "Jueves" },
  { clave: "vie", etiqueta: "Viernes" },
  { clave: "sab", etiqueta: "Sábado" },
  { clave: "dom", etiqueta: "Domingo" },
];

const HORARIO_VACIO: HorarioSemana = Object.fromEntries(
  DIAS.map((d) => [d.clave, { abierto: false, inicio: "09:00", fin: "19:00" }])
) as HorarioSemana;

export function horarioDesdeJson(json: unknown): HorarioSemana {
  const resultado = { ...HORARIO_VACIO };
  if (json && typeof json === "object") {
    for (const [dia, rangos] of Object.entries(json as Record<string, unknown>)) {
      if (dia in resultado && Array.isArray(rangos) && rangos[0]) {
        const [inicio, fin] = rangos[0] as [string, string];
        resultado[dia as keyof HorarioSemana] = { abierto: true, inicio, fin };
      }
    }
  }
  return resultado;
}

export interface SedeExistente {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  horario_base: unknown;
  latitud: number | null;
  longitud: number | null;
}

/**
 * Formulario de Sede — único lugar donde vive esta UI (nombre, dirección,
 * ubicación, horario semanal). Lo usan tanto el wizard de registro de
 * Negocio (Módulo 2.1, primera Sede) como la Gestión de Sedes (Módulo 2.3,
 * crear una sede adicional o editar una existente) — antes de este
 * componente, el wizard tenía su propia copia de esta misma UI.
 */
export interface SedeGuardada {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  horario_base: unknown;
  latitud: number | null;
  longitud: number | null;
  esPrincipal?: boolean;
}

export function FormularioSede({
  negocioId,
  sedeExistente,
  textoBoton = "GUARDAR",
  onGuardado,
}: {
  negocioId: string;
  sedeExistente?: SedeExistente | null;
  textoBoton?: string;
  onGuardado: (sede: SedeGuardada) => void;
}) {
  const [nombre, setNombre] = useState(sedeExistente?.nombre ?? "Sede principal");
  const [direccion, setDireccion] = useState(sedeExistente?.direccion ?? "");
  const [ciudad, setCiudad] = useState(sedeExistente?.ciudad ?? "");
  const [horario, setHorario] = useState<HorarioSemana>(horarioDesdeJson(sedeExistente?.horario_base));
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(
    sedeExistente?.latitud && sedeExistente?.longitud
      ? { lat: sedeExistente.latitud, lng: sedeExistente.longitud }
      : null
  );
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizarDia(dia: keyof HorarioSemana, cambios: Partial<HorarioSemana[keyof HorarioSemana]>) {
    setHorario((prev) => ({ ...prev, [dia]: { ...prev[dia], ...cambios } }));
  }

  function aplicarATodos() {
    const lunes = horario.lun;
    setHorario((prev) =>
      Object.fromEntries(Object.keys(prev).map((d) => [d, { ...lunes }])) as HorarioSemana
    );
  }

  function usarUbicacionActual() {
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalización — podés seguir sin esto.");
      return;
    }
    setBuscandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordenadas({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBuscandoUbicacion(false);
      },
      () => {
        setError("No pudimos acceder a tu ubicación — revisá los permisos del navegador.");
        setBuscandoUbicacion(false);
      },
      { timeout: 10000 }
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Object.values(horario).some((d) => d.abierto)) {
      setError("Marcá al menos un día como abierto.");
      return;
    }
    setGuardando(true);
    setError(null);

    const payload = {
      nombre,
      direccion,
      ciudad,
      horario,
      latitud: coordenadas?.lat ?? null,
      longitud: coordenadas?.lng ?? null,
    };

    const base = {
      nombre,
      direccion,
      ciudad,
      horario_base: null, // se relee de la base la próxima vez que haga falta
      latitud: coordenadas?.lat ?? null,
      longitud: coordenadas?.lng ?? null,
    };

    // Ramas separadas (no un ternario) a propósito: actualizarSede() y
    // crearSede() devuelven formas distintas de Resultado (una sin `data`,
    // otra con `{id, esPrincipal}`) — unificarlas en una sola variable le
    // hace perder a TypeScript el tipo exacto de cada una.
    if (sedeExistente) {
      const res = await actualizarSede({ sedeId: sedeExistente.id, ...payload });
      setGuardando(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onGuardado({ id: sedeExistente.id, ...base });
      return;
    }

    const res = await crearSede({ negocioId, ...payload });
    setGuardando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onGuardado({ id: res.data.id, ...base, esPrincipal: res.data.esPrincipal });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Input label="Nombre de la sede" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Input label="Dirección" required value={direccion} onChange={(e) => setDireccion(e.target.value)} />
      <Input label="Ciudad" required value={ciudad} onChange={(e) => setCiudad(e.target.value)} />

      <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-3.5">
        <div>
          <p className="text-[13px] font-semibold text-text">Ubicación en el mapa</p>
          <p className="text-[11.5px] text-text-faint">
            {coordenadas
              ? `${coordenadas.lat.toFixed(5)}, ${coordenadas.lng.toFixed(5)} — capturada`
              : "Ayuda a que te encuentren en el Marketplace"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={buscandoUbicacion}
          onClick={usarUbicacionActual}
        >
          Usar mi ubicación
        </Button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
            Horario de atención
          </label>
          <button type="button" onClick={aplicarATodos} className="text-[11.5px] font-semibold text-accent">
            Aplicar lunes a todos
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {DIAS.map((d) => (
            <div key={d.clave} className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-3 py-2">
              <label className="flex w-24 shrink-0 items-center gap-2 text-[12.5px] text-text">
                <input
                  type="checkbox"
                  checked={horario[d.clave].abierto}
                  onChange={(e) => actualizarDia(d.clave, { abierto: e.target.checked })}
                  className="size-4 accent-accent"
                />
                {d.etiqueta}
              </label>
              {horario[d.clave].abierto ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={horario[d.clave].inicio}
                    onChange={(e) => actualizarDia(d.clave, { inicio: e.target.value })}
                    className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[12.5px] text-text"
                  />
                  <span className="text-text-faint">–</span>
                  <input
                    type="time"
                    value={horario[d.clave].fin}
                    onChange={(e) => actualizarDia(d.clave, { fin: e.target.value })}
                    className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[12.5px] text-text"
                  />
                </div>
              ) : (
                <span className="flex-1 text-[12px] text-text-faint">Cerrado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <Button type="submit" size="lg" loading={guardando} className="w-full">
        {textoBoton}
      </Button>
    </form>
  );
}
