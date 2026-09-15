"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { configurarConsumo, quitarConsumo, type ConsumoServicio } from "../actions";

export function EditorConsumo({
  servicios,
  productos,
  consumoInicial,
}: {
  servicios: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
  consumoInicial: ConsumoServicio[];
}) {
  const [consumo, setConsumo] = useState(consumoInicial);
  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? "");
  const [productoId, setProductoId] = useState(productos[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("1");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!servicioId || !productoId) return;
    setGuardando(true);
    setError(null);
    const res = await configurarConsumo(servicioId, productoId, Number(cantidad));
    setGuardando(false);
    if (!res.ok) return setError(res.error);

    const servicio = servicios.find((s) => s.id === servicioId)!;
    const producto = productos.find((p) => p.id === productoId)!;
    setConsumo((prev) => [
      ...prev.filter((c) => !(c.servicioId === servicioId && c.productoId === productoId)),
      { servicioId, servicioNombre: servicio.nombre, productoId, productoNombre: producto.nombre, cantidad: Number(cantidad) },
    ]);
  }

  async function onQuitar(servicioIdQ: string, productoIdQ: string) {
    const anterior = consumo;
    setConsumo((prev) => prev.filter((c) => !(c.servicioId === servicioIdQ && c.productoId === productoIdQ)));
    const res = await quitarConsumo(servicioIdQ, productoIdQ);
    if (!res.ok) setConsumo(anterior);
  }

  if (servicios.length === 0 || productos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
        Necesitás al menos un Servicio activo y un Producto activo para configurar consumo.
      </p>
    );
  }

  return (
    <div>
      {consumo.length > 0 ? (
        <ul className="mb-6 flex flex-col gap-2">
          {consumo.map((c) => (
            <li key={`${c.servicioId}-${c.productoId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5">
              <p className="text-[12.5px] text-text">
                <strong>{c.servicioNombre}</strong> consume <strong>{c.cantidad}</strong> de {c.productoNombre}
              </p>
              <button type="button" onClick={() => onQuitar(c.servicioId, c.productoId)} className="text-[11.5px] font-semibold text-danger">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
          Ningún Servicio tiene consumo automático configurado todavía.
        </p>
      )}

      <form onSubmit={onAgregar} className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
        <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} className="h-11 rounded-xl border border-border bg-bg px-3 text-[13px] text-text">
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className="h-11 rounded-xl border border-border bg-bg px-3 text-[13px] text-text">
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="h-11 rounded-xl border border-border bg-bg px-3 text-[13px] text-text"
        />
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
        <Button type="submit" variant="secondary" loading={guardando}>
          Guardar regla de consumo
        </Button>
      </form>
    </div>
  );
}
