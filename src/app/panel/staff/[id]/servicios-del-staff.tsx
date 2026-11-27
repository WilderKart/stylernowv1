"use client";

import { definirServiciosDeStaff } from "@/app/panel/servicios/actions";
import { ImagenServicio } from "@/components/servicios/imagen-servicio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ServicioAsignable {
  id: string;
  nombre: string;
  imagen_url: string | null;
  precio_base: number;
  asignado: boolean;
}

/**
 * Servicios que presta este miembro del equipo. Se asignan desde aquí sin tener que ir servicio por servicio: el negocio marca o
 * desmarca y listo. La base vuelve a validar que el servicio y la persona sean del negocio.
 */
export function ServiciosDelStaff({
  staffId,
  nombre,
  inicial,
  puedeCatalogo,
}: {
  staffId: string;
  nombre: string;
  inicial: ServicioAsignable[];
  puedeCatalogo: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function aplicar(ids: string[], asignar: boolean) {
    if (ids.length === 0) return;
    const anterior = items;
    setItems((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, asignado: asignar } : s)));
    setError(null);
    setOcupado(true);
    const r = await definirServiciosDeStaff(staffId, ids, asignar);
    setOcupado(false);
    if (!r.ok) {
      setItems(anterior);
      setError(r.error);
      return;
    }
    router.refresh();
  }

  const sinAsignar = items.filter((s) => !s.asignado).map((s) => s.id);
  const asignados = items.filter((s) => s.asignado).length;

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-text">Servicios que presta</p>
          <p className="mt-0.5 text-[12px] text-text-faint">
            {asignados} de {items.length} · {nombre} solo recibe reservas de los servicios marcados.
          </p>
        </div>
        {sinAsignar.length > 0 ? (
          <Button size="sm" variant="secondary" disabled={ocupado} onClick={() => aplicar(sinAsignar, true)}>
            Marcar todos
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-3 border-2 border-dashed border-border p-4 text-center text-[12.5px] text-text-muted">
          Todavía no tienes servicios.{" "}
          {puedeCatalogo ? (
            <Link href="/panel/servicios/catalogo" className="font-bold underline">
              Elígelos del catálogo
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={ocupado}
                aria-pressed={s.asignado}
                onClick={() => aplicar([s.id], !s.asignado)}
                className={`flex w-full items-center gap-3 border-2 p-2.5 text-left transition-colors disabled:opacity-60 ${s.asignado ? "border-ink bg-surface" : "border-border"}`}
              >
                <ImagenServicio url={s.imagen_url} nombre={s.nombre} className="size-11" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-text">{s.nombre}</span>
                  <span className="block text-[11.5px] text-text-faint">{formatCOP(s.precio_base)}</span>
                </span>
                <span className={`shrink-0 border-2 px-2.5 py-1 text-[11px] font-bold uppercase ${s.asignado ? "border-ink bg-signal text-ink" : "border-border text-text-muted"}`}>
                  {s.asignado ? "Lo presta" : "Asignar"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {puedeCatalogo && items.length > 0 ? (
        <p className="mt-3 text-[12px] text-text-muted">
          ¿Falta alguno?{" "}
          <Link href="/panel/servicios/catalogo" className="font-bold underline">
            Agrégalo desde el catálogo
          </Link>{" "}
          o{" "}
          <Link href="/panel/servicios/nuevo" className="font-bold underline">
            crea uno propio
          </Link>
          .
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
