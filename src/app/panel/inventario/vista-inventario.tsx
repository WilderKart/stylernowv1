"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import {
  ajustarStock,
  atenderSolicitud,
  cancelarSolicitud,
  configurarStockMinimo,
  crearSolicitudReposicion,
  registrarMovimiento,
  type SolicitudReposicion,
  type StockProducto,
} from "./actions";

export function VistaInventario({
  negocioId,
  sedes,
  sedeActivaId,
  stockInicial,
  solicitudesIniciales,
  errorInicial,
  puedeConfigurarReglas,
}: {
  negocioId: string;
  sedes: { id: string; nombre: string }[] | null;
  sedeActivaId: string;
  stockInicial: StockProducto[];
  solicitudesIniciales: SolicitudReposicion[];
  errorInicial: string | null;
  puedeConfigurarReglas: boolean;
}) {
  const [stock, setStock] = useState(stockInicial);
  const [solicitudes, setSolicitudes] = useState(solicitudesIniciales);
  const [error, setError] = useState(errorInicial);
  const [productoAbierto, setProductoAbierto] = useState<string | null>(null);

  function cambiarSede(sedeId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("sede", sedeId);
    window.location.href = url.toString();
  }

  async function onMovimiento(productoId: string, tipo: "ENTRADA" | "SALIDA", cantidad: number, motivo?: string) {
    setError(null);
    const res = await registrarMovimiento({ productoId, sedeId: sedeActivaId, tipo, cantidad, motivo });
    if (!res.ok) return setError(res.error);
    setStock((prev) =>
      prev.map((p) =>
        p.productoId === productoId
          ? { ...p, stockActual: p.stockActual + (tipo === "ENTRADA" ? cantidad : -cantidad), enAlerta: p.stockActual + (tipo === "ENTRADA" ? cantidad : -cantidad) <= p.stockMinimo }
          : p
      )
    );
  }

  async function onAjustar(productoId: string, nuevoStock: number) {
    setError(null);
    const res = await ajustarStock(productoId, sedeActivaId, nuevoStock);
    if (!res.ok) return setError(res.error);
    setStock((prev) => prev.map((p) => (p.productoId === productoId ? { ...p, stockActual: nuevoStock, enAlerta: nuevoStock <= p.stockMinimo } : p)));
  }

  async function onConfigurarMinimo(productoId: string, minimo: number) {
    setError(null);
    const res = await configurarStockMinimo(productoId, sedeActivaId, minimo);
    if (!res.ok) return setError(res.error);
    setStock((prev) => prev.map((p) => (p.productoId === productoId ? { ...p, stockMinimo: minimo, enAlerta: p.stockActual <= minimo } : p)));
  }

  async function onSolicitarReposicion(productoId: string, cantidad: number) {
    setError(null);
    const res = await crearSolicitudReposicion({ negocioId, sedeId: sedeActivaId, productoId, cantidadSolicitada: cantidad });
    if (!res.ok) return setError(res.error);
    const producto = stock.find((p) => p.productoId === productoId);
    setSolicitudes((prev) => [
      { id: crypto.randomUUID(), productoId, productoNombre: producto?.nombre ?? "", cantidadSolicitada: cantidad, motivo: null, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }

  async function onAtenderSolicitud(id: string) {
    setError(null);
    const res = await atenderSolicitud(id);
    if (!res.ok) return setError(res.error);
    setSolicitudes((prev) => prev.filter((s) => s.id !== id));
  }

  async function onCancelarSolicitud(id: string) {
    setError(null);
    const res = await cancelarSolicitud(id);
    if (!res.ok) return setError(res.error);
    setSolicitudes((prev) => prev.filter((s) => s.id !== id));
  }

  const enAlerta = stock.filter((p) => p.enAlerta);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold uppercase text-text">Inventario</h1>
          <p className="mt-1 text-[12.5px] text-text-muted">{stock.length} productos</p>
        </div>
        <div className="flex items-center gap-2">
          {sedes && sedes.length > 1 ? (
            <select
              value={sedeActivaId}
              onChange={(e) => cambiarSede(e.target.value)}
              className="h-9 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none"
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          ) : null}
          {puedeConfigurarReglas ? (
            <Link href="/panel/inventario/consumo" className="rounded-full border border-border px-3.5 py-2 text-[12px] font-bold text-text-muted hover:border-accent/40">
              Consumo por Servicio
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {enAlerta.length > 0 ? (
        <Card className="mb-6 border-danger/30 bg-danger-soft">
          <p className="text-[12.5px] font-semibold text-danger">
            {enAlerta.length} producto{enAlerta.length === 1 ? "" : "s"} en o bajo su stock mínimo
          </p>
          <p className="mt-1 text-[12px] text-text-muted">{enAlerta.map((p) => p.nombre).join(", ")}</p>
        </Card>
      ) : null}

      {solicitudes.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">Solicitudes de reposición pendientes</h2>
          <ul className="flex flex-col gap-2">
            {solicitudes.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border-subtle bg-surface p-3.5">
                <div>
                  <p className="text-[12.5px] font-semibold text-text">{s.productoNombre}</p>
                  <p className="text-[11px] text-text-faint">{s.cantidadSolicitada} unidades solicitadas</p>
                </div>
                <div className="flex gap-1.5">
                  {puedeConfigurarReglas ? (
                    <Button size="sm" variant="secondary" onClick={() => onAtenderSolicitud(s.id)}>
                      Atender
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => onCancelarSolicitud(s.id)}>
                    Cancelar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stock.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          Todavía no tenés productos — creálos desde Caja → Productos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {stock.map((p) => (
            <ProductoFila
              key={p.productoId}
              producto={p}
              abierto={productoAbierto === p.productoId}
              onAbrir={() => setProductoAbierto(productoAbierto === p.productoId ? null : p.productoId)}
              onMovimiento={onMovimiento}
              onAjustar={onAjustar}
              onConfigurarMinimo={onConfigurarMinimo}
              onSolicitarReposicion={onSolicitarReposicion}
              puedeConfigurarReglas={puedeConfigurarReglas}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function ProductoFila({
  producto,
  abierto,
  onAbrir,
  onMovimiento,
  onAjustar,
  onConfigurarMinimo,
  onSolicitarReposicion,
  puedeConfigurarReglas,
}: {
  producto: StockProducto;
  abierto: boolean;
  onAbrir: () => void;
  onMovimiento: (productoId: string, tipo: "ENTRADA" | "SALIDA", cantidad: number, motivo?: string) => void;
  onAjustar: (productoId: string, nuevoStock: number) => void;
  onConfigurarMinimo: (productoId: string, minimo: number) => void;
  onSolicitarReposicion: (productoId: string, cantidad: number) => void;
  puedeConfigurarReglas: boolean;
}) {
  const [cantidad, setCantidad] = useState("");
  const [minimo, setMinimo] = useState(String(producto.stockMinimo));

  return (
    <li className="rounded-2xl border border-border-subtle bg-surface p-4">
      <button type="button" onClick={onAbrir} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className="text-[13.5px] font-bold text-text">{producto.nombre}</p>
          <p className="text-[11.5px] text-text-faint">
            {formatCOP(producto.precio)} · mínimo {producto.stockMinimo}
          </p>
        </div>
        <Badge tone={producto.enAlerta ? "danger" : "success"}>{producto.stockActual} en stock</Badge>
      </button>

      {abierto ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              placeholder="Cantidad"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-border bg-bg px-2 text-[12px] text-text"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!cantidad}
              onClick={() => {
                onMovimiento(producto.productoId, "ENTRADA", Number(cantidad));
                setCantidad("");
              }}
            >
              + Entrada
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!cantidad}
              onClick={() => {
                onMovimiento(producto.productoId, "SALIDA", Number(cantidad));
                setCantidad("");
              }}
            >
              - Salida
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onSolicitarReposicion(producto.productoId, Math.max(producto.stockMinimo * 2, 1))}>
              Solicitar reposición
            </Button>
            <button
              type="button"
              onClick={() => {
                const nuevo = prompt("Nuevo conteo físico de stock:", String(producto.stockActual));
                if (nuevo != null && !Number.isNaN(Number(nuevo))) onAjustar(producto.productoId, Number(nuevo));
              }}
              className="text-[11.5px] font-semibold text-text-muted underline"
            >
              Ajustar por conteo físico
            </button>
          </div>

          {puedeConfigurarReglas ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={minimo}
                onChange={(e) => setMinimo(e.target.value)}
                className="h-9 w-24 rounded-lg border border-border bg-bg px-2 text-[12px] text-text"
              />
              <Button size="sm" variant="ghost" onClick={() => onConfigurarMinimo(producto.productoId, Number(minimo))}>
                Guardar stock mínimo
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
