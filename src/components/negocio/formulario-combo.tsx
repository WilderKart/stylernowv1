"use client";

import { actualizarCombo, crearCombo } from "@/app/panel/servicios/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { duracion } from "@/lib/formato";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";

export interface ServicioParaCombo {
  id: string;
  nombre: string;
  duracion_minutos: number;
  precio_base: number;
}

export interface ComboExistente {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_total_override: number | null;
  duracion_minutos_override: number | null;
  servicioIdsIniciales: string[];
}

export function FormularioCombo({
  negocioId,
  servicios,
  comboExistente,
  textoBoton,
  onGuardado,
}: {
  negocioId: string;
  servicios: ServicioParaCombo[];
  comboExistente?: ComboExistente;
  textoBoton: string;
  onGuardado: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(comboExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(comboExistente?.descripcion ?? "");
  const [servicioIds, setServicioIds] = useState<string[]>(comboExistente?.servicioIdsIniciales ?? []);
  const [usarOverride, setUsarOverride] = useState(
    comboExistente?.precio_total_override != null || comboExistente?.duracion_minutos_override != null
  );
  const [precioOverride, setPrecioOverride] = useState(
    comboExistente?.precio_total_override != null ? String(comboExistente.precio_total_override) : ""
  );
  const [duracionOverride, setDuracionOverride] = useState(
    comboExistente?.duracion_minutos_override != null ? String(comboExistente.duracion_minutos_override) : ""
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seleccionados = servicios.filter((s) => servicioIds.includes(s.id));
  const sumaDuracion = seleccionados.reduce((acc, s) => acc + s.duracion_minutos, 0);
  const sumaPrecio = seleccionados.reduce((acc, s) => acc + s.precio_base, 0);

  function alternar(id: string) {
    setServicioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (servicioIds.length < 2) {
      setError("Elegí al menos 2 servicios para el combo.");
      return;
    }
    setGuardando(true);
    setError(null);

    const datos = {
      nombre,
      descripcion,
      servicioIds,
      precioTotalOverride: usarOverride && precioOverride ? Number(precioOverride) : undefined,
      duracionMinutosOverride: usarOverride && duracionOverride ? Number(duracionOverride) : undefined,
    };

    if (comboExistente) {
      const res = await actualizarCombo(comboExistente.id, datos);
      setGuardando(false);
      if (!res.ok) return setError(res.error);
      onGuardado(comboExistente.id);
      return;
    }

    const res = await crearCombo({ negocioId, ...datos });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    onGuardado(res.data.id);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-5">
      <Input label="Nombre del combo" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Input
        label="Descripción (opcional)"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />

      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">
          Servicios incluidos (mínimo 2)
        </label>
        {servicios.length === 0 ? (
          <p className="text-[12.5px] text-text-faint">No hay servicios activos para combinar.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {servicios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => alternar(s.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                    servicioIds.includes(s.id) ? "border-accent bg-accent-soft" : "border-border"
                  }`}
                >
                  <span className="text-[12.5px] font-semibold text-text">{s.nombre}</span>
                  <span className="text-[11px] text-text-faint">
                    {duracion(s.duracion_minutos)} · {formatCOP(s.precio_base)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {seleccionados.length >= 2 ? (
        <p className="text-[11.5px] text-text-faint">
          Suma de servicios: {duracion(sumaDuracion)} · {formatCOP(sumaPrecio)}
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-[12.5px] text-text-muted">
        <input type="checkbox" checked={usarOverride} onChange={(e) => setUsarOverride(e.target.checked)} />
        Definir un precio/duración especial para el combo (en vez de sumar los servicios)
      </label>

      {usarOverride ? (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duración del combo (min, opcional)"
              type="number"
              min={5}
              max={480}
              placeholder={String(sumaDuracion || "")}
              value={duracionOverride}
              onChange={(e) => setDuracionOverride(e.target.value)}
            />
            <Input
              label="Precio del combo (COP, opcional)"
              type="number"
              min={0}
              placeholder={String(sumaPrecio || "")}
              value={precioOverride}
              onChange={(e) => setPrecioOverride(e.target.value)}
            />
          </div>
          <p className="mt-2 text-[11px] text-text-faint">
            Por ahora este valor es solo informativo en la ficha del combo — el motor de
            reservas sigue sumando la duración y el precio de cada servicio individual al
            reservar (ver `docs/TECH_DEBT_REGISTER.md`).
          </p>
        </div>
      ) : null}

      {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}
      <Button type="submit" loading={guardando} className="w-full">
        {textoBoton}
      </Button>
    </form>
  );
}
