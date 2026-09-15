"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hora } from "@/lib/formato";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  completarVenta,
  obtenerPuntosDisponibles,
  type ProductoPOS,
  type ReservaParaCobrar,
  type ResultadoVenta,
} from "./actions";

export function ListaPOS({
  negocioId,
  reservasIniciales,
  productos,
  errorInicial,
}: {
  negocioId: string;
  reservasIniciales: ReservaParaCobrar[];
  productos: ProductoPOS[];
  errorInicial: string | null;
}) {
  const [reservas, setReservas] = useState(reservasIniciales);
  const [seleccionada, setSeleccionada] = useState<ReservaParaCobrar | null>(null);
  const error = errorInicial;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold uppercase text-text">Caja</h1>
          <p className="mt-1 text-[12.5px] text-text-muted">Citas de hoy listas para cobrar</p>
        </div>
        <div className="flex gap-2">
          <Link href="/panel/pos/productos" className="rounded-full border border-border px-3.5 py-2 text-[12px] font-bold text-text-muted hover:border-accent/40">
            Productos
          </Link>
          <Link href="/panel/pos/caja" className="rounded-full border border-border px-3.5 py-2 text-[12px] font-bold text-text-muted hover:border-accent/40">
            Cierre de caja
          </Link>
        </div>
      </div>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {reservas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          No hay citas confirmadas de hoy todavía listas para cobrar.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {reservas.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSeleccionada(r)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 text-left transition-colors hover:border-accent/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-text">
                    {hora(r.horaInicio)} · {r.clienteNombre}
                  </p>
                  <p className="truncate text-[12px] text-text-faint">
                    {r.servicios} {r.staffNombre ? `· ${r.staffNombre}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-bold text-text">{formatCOP(r.montoTotal - r.montoSena)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {seleccionada ? (
        <ModalCobro
          negocioId={negocioId}
          reserva={seleccionada}
          productos={productos}
          onCerrar={() => setSeleccionada(null)}
          onCobrado={(reservaId) => {
            setReservas((prev) => prev.filter((r) => r.id !== reservaId));
            setSeleccionada(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ModalCobro({
  negocioId,
  reserva,
  productos,
  onCerrar,
  onCobrado,
}: {
  negocioId: string;
  reserva: ReservaParaCobrar;
  productos: ProductoPOS[];
  onCerrar: () => void;
  onCobrado: (reservaId: string) => void;
}) {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [metodoPagoSaldo, setMetodoPagoSaldo] = useState<"EFECTIVO" | "DATAFONO_PROPIO">("EFECTIVO");
  const [propina, setPropina] = useState("");
  const [puntosDisponibles, setPuntosDisponibles] = useState<number | null>(null);
  const [puntosACanjear, setPuntosACanjear] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoVenta | null>(null);

  useEffect(() => {
    obtenerPuntosDisponibles(negocioId, reserva.clienteId).then((res) => {
      if (res.ok) setPuntosDisponibles(res.data);
    });
  }, [negocioId, reserva.clienteId]);

  const totalProductos = productos.reduce((acc, p) => acc + (cantidades[p.id] ?? 0) * p.precio, 0);
  const saldoServicio = reserva.montoTotal - reserva.montoSena;
  const totalEstimado = saldoServicio + totalProductos;

  async function onCobrar() {
    setProcesando(true);
    setError(null);
    const res = await completarVenta({
      reservaId: reserva.id,
      productos: Object.entries(cantidades)
        .filter(([, c]) => c > 0)
        .map(([productoId, cantidad]) => ({ productoId, cantidad })),
      metodoPagoSaldo,
      propina: propina ? Number(propina) : 0,
      // La propina se cobra por el mismo medio que el saldo — no hay un
      // caso real de "saldo en efectivo, propina por datáfono" que amerite
      // un segundo selector en la UI.
      metodoPagoPropina: metodoPagoSaldo,
      puntosACanjear: puntosACanjear ? Number(puntosACanjear) : 0,
    });
    setProcesando(false);
    if (!res.ok) return setError(res.error);
    setResultado(res.data);
  }

  if (resultado) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5">
        <div className="w-full max-w-sm rounded-3xl bg-bg p-6 text-center">
          <p className="text-[16px] font-bold text-text">Venta registrada</p>
          <div className="mt-4 flex flex-col gap-2 text-left text-[12.5px]">
            <div className="flex justify-between"><span className="text-text-faint">Cobrado</span><span className="font-bold text-text">{formatCOP(resultado.saldoCobrado)}</span></div>
            {resultado.descuentoPuntos > 0 ? (
              <div className="flex justify-between"><span className="text-text-faint">Descuento por puntos</span><span className="font-bold text-text">-{formatCOP(resultado.descuentoPuntos)}</span></div>
            ) : null}
            {resultado.propina > 0 ? (
              <div className="flex justify-between"><span className="text-text-faint">Propina</span><span className="font-bold text-text">{formatCOP(resultado.propina)}</span></div>
            ) : null}
            <div className="flex justify-between"><span className="text-text-faint">Puntos otorgados</span><span className="font-bold text-text">+{resultado.puntosOtorgados}</span></div>
          </div>
          <Button className="mt-5 w-full" onClick={() => onCobrado(reserva.id)}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCerrar}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 text-[15px] font-bold text-text">{reserva.clienteNombre}</p>
        <p className="mb-4 text-[12px] text-text-faint">{reserva.servicios} · Saldo del servicio {formatCOP(saldoServicio)}</p>

        {productos.length > 0 ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Productos vendidos (opcional)</label>
            <div className="flex flex-col gap-1.5">
              {productos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <span className="text-[12.5px] text-text">{p.nombre} · {formatCOP(p.precio)}</span>
                  <input
                    type="number"
                    min={0}
                    value={cantidades[p.id] ?? 0}
                    onChange={(e) => setCantidades((prev) => ({ ...prev, [p.id]: Math.max(0, Number(e.target.value)) }))}
                    className="h-8 w-16 rounded-lg border border-border bg-bg px-2 text-center text-[12px] text-text"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {puntosDisponibles != null && puntosDisponibles > 0 ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">
              Canjear Puntos ({puntosDisponibles} disponibles)
            </label>
            <input
              type="number"
              min={0}
              max={puntosDisponibles}
              value={puntosACanjear}
              onChange={(e) => setPuntosACanjear(e.target.value)}
              placeholder="0"
              className="h-10 w-full rounded-lg border border-border bg-bg px-2 text-[12.5px] text-text"
            />
          </div>
        ) : null}

        <div className="mb-4">
          <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Método de pago del saldo</label>
          <div className="flex gap-2">
            {(["EFECTIVO", "DATAFONO_PROPIO"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodoPagoSaldo(m)}
                className={`flex-1 rounded-xl border px-3 py-2 text-[12.5px] font-semibold ${
                  metodoPagoSaldo === m ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
                }`}
              >
                {m === "EFECTIVO" ? "Efectivo" : "Datáfono propio"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Propina (opcional)</label>
          <input
            type="number"
            min={0}
            value={propina}
            onChange={(e) => setPropina(e.target.value)}
            placeholder="0"
            className="h-10 w-full rounded-lg border border-border bg-bg px-2 text-[12.5px] text-text"
          />
        </div>

        <Card className="mb-4">
          <div className="flex justify-between text-[13px]">
            <span className="text-text-muted">Total estimado</span>
            <span className="font-bold text-text">{formatCOP(totalEstimado)}</span>
          </div>
        </Card>

        {error ? <p className="mb-3 text-[12.5px] font-semibold text-danger">{error}</p> : null}

        <Button className="w-full" loading={procesando} onClick={onCobrar}>
          Cobrar
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
