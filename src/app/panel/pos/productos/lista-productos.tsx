"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import { cambiarEstadoProducto, crearProducto, type ProductoPOS } from "../actions";

export function ListaProductos({ negocioId, productosIniciales }: { negocioId: string; productosIniciales: ProductoPOS[] }) {
  const [productos, setProductos] = useState(productosIniciales);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const res = await crearProducto(negocioId, nombre, Number(precio));
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setProductos((prev) => [...prev, { id: crypto.randomUUID(), nombre: nombre.trim(), precio: Number(precio), estado: "ACTIVO" }]);
    setNombre("");
    setPrecio("");
  }

  async function onCambiarEstado(id: string, activar: boolean) {
    const anterior = productos;
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: activar ? "ACTIVO" : "INACTIVO" } : p)));
    const res = await cambiarEstadoProducto(id, activar);
    if (!res.ok) setProductos(anterior);
  }

  return (
    <div>
      {productos.length === 0 ? (
        <p className="mb-4 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
          Todavía no tenés productos.
        </p>
      ) : (
        <ul className="mb-6 flex flex-col gap-2">
          {productos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5">
              <div>
                <p className="text-[13px] font-semibold text-text">{p.nombre}</p>
                <p className="text-[11.5px] text-text-faint">{formatCOP(p.precio)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={p.estado === "ACTIVO" ? "success" : "neutral"}>{p.estado}</Badge>
                <Button size="sm" variant="secondary" onClick={() => onCambiarEstado(p.id, p.estado !== "ACTIVO")}>
                  {p.estado === "ACTIVO" ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onCrear} className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-text-muted">Nuevo producto</p>
        <Input label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input label="Precio (COP)" type="number" min={0} required value={precio} onChange={(e) => setPrecio(e.target.value)} />
        {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}
        <Button type="submit" variant="secondary" loading={guardando}>
          Agregar producto
        </Button>
      </form>
    </div>
  );
}
