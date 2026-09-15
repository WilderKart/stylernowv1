"use client";

import { actualizarServicio, crearServicio } from "@/app/panel/servicios/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export interface ServicioExistente {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  precio_base: number;
  categoria_puntaje: "ESTANDAR" | "PREMIUM" | "COMPLEMENTARIO";
  buffer_previo_minutos: number;
  buffer_posterior_minutos: number;
}

const CATEGORIAS: { valor: ServicioExistente["categoria_puntaje"]; etiqueta: string; ayuda: string }[] = [
  { valor: "ESTANDAR", etiqueta: "Estándar", ayuda: "Servicio habitual — puntaje base para el Staff" },
  { valor: "PREMIUM", etiqueta: "Premium", ayuda: "Servicio de alto valor — más puntos para el Nivel del Staff" },
  { valor: "COMPLEMENTARIO", etiqueta: "Complementario", ayuda: "Add-on o extra — menos puntos, suele combinarse con otro" },
];

/**
 * Módulo 2.5 — único formulario de Servicio, usado por el wizard de
 * onboarding (2.1, versión mínima) y por `/panel/servicios` (completo).
 * `puedeEditarPrecio=false` oculta el campo de precio para Guardian
 * (03-Business-Rules/01_Roles.md: "Cambiar precio" es exclusivo de
 * Barbería) — la base ya lo rechaza con un trigger aunque este control no
 * existiera, esto solo alinea la UI con esa realidad.
 */
export function FormularioServicio({
  negocioId,
  servicioExistente,
  puedeEditarPrecio,
  textoBoton,
  onGuardado,
}: {
  negocioId: string;
  servicioExistente?: ServicioExistente;
  puedeEditarPrecio: boolean;
  textoBoton: string;
  onGuardado: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(servicioExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(servicioExistente?.descripcion ?? "");
  const [duracionMinutos, setDuracionMinutos] = useState(String(servicioExistente?.duracion_minutos ?? 30));
  const [precioBase, setPrecioBase] = useState(String(servicioExistente?.precio_base ?? ""));
  const [categoriaPuntaje, setCategoriaPuntaje] = useState<ServicioExistente["categoria_puntaje"]>(
    servicioExistente?.categoria_puntaje ?? "ESTANDAR"
  );
  const [bufferPrevio, setBufferPrevio] = useState(String(servicioExistente?.buffer_previo_minutos ?? 0));
  const [bufferPosterior, setBufferPosterior] = useState(String(servicioExistente?.buffer_posterior_minutos ?? 0));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const datos = {
      nombre,
      descripcion,
      duracionMinutos: Number(duracionMinutos),
      precioBase: puedeEditarPrecio ? Number(precioBase) : (servicioExistente?.precio_base ?? 0),
      categoriaPuntaje,
      bufferPrevioMinutos: Number(bufferPrevio),
      bufferPosteriorMinutos: Number(bufferPosterior),
    };

    if (servicioExistente) {
      const res = await actualizarServicio(servicioExistente.id, datos);
      setGuardando(false);
      if (!res.ok) return setError(res.error);
      onGuardado(servicioExistente.id);
      return;
    }

    const res = await crearServicio({ negocioId, ...datos });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    onGuardado(res.data.id);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-5">
      <Input label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Input
        label="Descripción (opcional)"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Duración (min)"
          type="number"
          min={5}
          max={480}
          required
          value={duracionMinutos}
          onChange={(e) => setDuracionMinutos(e.target.value)}
        />
        {puedeEditarPrecio ? (
          <Input
            label="Precio (COP)"
            type="number"
            min={0}
            required
            value={precioBase}
            onChange={(e) => setPrecioBase(e.target.value)}
          />
        ) : (
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Precio</label>
            <p className="flex h-12 items-center text-[13.5px] text-text-faint">
              Solo la Barbería puede cambiarlo
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Categoría de puntaje</label>
        <div className="flex flex-col gap-1.5">
          {CATEGORIAS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setCategoriaPuntaje(c.valor)}
              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                categoriaPuntaje === c.valor ? "border-accent bg-accent-soft" : "border-border"
              }`}
            >
              <p className="text-[12.5px] font-semibold text-text">{c.etiqueta}</p>
              <p className="text-[11px] text-text-faint">{c.ayuda}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Buffer previo (min)"
          type="number"
          min={0}
          value={bufferPrevio}
          onChange={(e) => setBufferPrevio(e.target.value)}
        />
        <Input
          label="Buffer posterior (min)"
          type="number"
          min={0}
          value={bufferPosterior}
          onChange={(e) => setBufferPosterior(e.target.value)}
        />
      </div>
      <p className="text-[11px] text-text-faint">
        Los buffers son tiempo de limpieza/preparación — ocupan la agenda del Staff pero nunca se cobran ni se muestran al Cliente.
      </p>

      {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}
      <Button type="submit" loading={guardando} className="w-full">
        {textoBoton}
      </Button>
    </form>
  );
}
