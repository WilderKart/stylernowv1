"use client";

import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  actualizarCostoAccionIa,
  actualizarModeloIa,
  actualizarPaqueteIa,
  configurarFuncionPlanIa,
  simularConsumoIa,
  type AccionCostoIa,
  type FuncionPlanIa,
  type ModeloIa,
  type PaqueteIa,
  type ResumenConsumoIa,
  type SimulacionIa,
} from "./actions";

const PLANES = ["RAVEN", "JARL", "VALHALLA", "ALLFATHER"] as const;

export function VistaAiCenter({
  accionesIniciales,
  modelosIniciales,
  paquetesIniciales,
  funcionesIniciales,
  resumenInicial,
}: {
  accionesIniciales: AccionCostoIa[];
  modelosIniciales: ModeloIa[];
  paquetesIniciales: PaqueteIa[];
  funcionesIniciales: FuncionPlanIa[];
  resumenInicial: ResumenConsumoIa | null;
}) {
  const [acciones, setAcciones] = useState(accionesIniciales);
  const [modelos, setModelos] = useState(modelosIniciales);
  const [paquetes, setPaquetes] = useState(paquetesIniciales);
  const [funciones, setFunciones] = useState(funcionesIniciales);
  const [pendiente, iniciarTransicion] = useTransition();

  const funcionesUnicas = Array.from(new Set(funciones.map((f) => f.funcion))).sort();
  const habilitado = (plan: string, funcion: string) => funciones.find((f) => f.planCodigo === plan && f.funcion === funcion)?.habilitado ?? false;

  function guardarCosto(a: AccionCostoIa, nuevoCosto: number, nuevoActivo: boolean) {
    iniciarTransicion(async () => {
      const r = await actualizarCostoAccionIa(a.accion, nuevoCosto, nuevoActivo);
      if (!r.ok) { toast.error(r.error); return; }
      setAcciones((prev) => prev.map((x) => (x.accion === a.accion ? { ...x, costoCreditos: nuevoCosto, activo: nuevoActivo } : x)));
      toast.success(`Costo de "${a.accion}" actualizado a ${nuevoCosto} créditos.`);
    });
  }

  function guardarModelo(m: ModeloIa, nuevoOrden: number, nuevoActivo: boolean) {
    iniciarTransicion(async () => {
      const r = await actualizarModeloIa(m.nombre, nuevoOrden, nuevoActivo);
      if (!r.ok) { toast.error(r.error); return; }
      setModelos((prev) => prev.map((x) => (x.nombre === m.nombre ? { ...x, ordenPreferencia: nuevoOrden, activo: nuevoActivo } : x)));
      toast.success(`Modelo "${m.nombre}" actualizado.`);
    });
  }

  function guardarPaquete(p: PaqueteIa, nuevoPrecio: number | null, nuevoActivo: boolean) {
    iniciarTransicion(async () => {
      const r = await actualizarPaqueteIa(p.id, nuevoPrecio, nuevoActivo);
      if (!r.ok) { toast.error(r.error); return; }
      setPaquetes((prev) => prev.map((x) => (x.id === p.id ? { ...x, precioCop: nuevoPrecio, activo: nuevoActivo } : x)));
      toast.success(`Paquete "${p.nombre}" actualizado.`);
    });
  }

  function alternarFuncion(plan: string, funcion: string) {
    const nuevoValor = !habilitado(plan, funcion);
    iniciarTransicion(async () => {
      const r = await configurarFuncionPlanIa(plan, funcion, nuevoValor);
      if (!r.ok) { toast.error(r.error); return; }
      setFunciones((prev) => {
        const existe = prev.some((f) => f.planCodigo === plan && f.funcion === funcion);
        return existe
          ? prev.map((f) => (f.planCodigo === plan && f.funcion === funcion ? { ...f, habilitado: nuevoValor } : f))
          : [...prev, { planCodigo: plan, funcion, habilitado: nuevoValor }];
      });
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Resumen de consumo</h2>
        {resumenInicial ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="text-center">
              <p className="text-[22px] font-bold text-text">{resumenInicial.creditosConsumidosTotal}</p>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Créditos consumidos</p>
            </Card>
            <Card className="text-center">
              <p className="text-[22px] font-bold text-text">{resumenInicial.negociosActivosConsumiendo}</p>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Negocios usando IA</p>
            </Card>
            <Card className="text-center">
              <p className="text-[22px] font-bold text-text">US${resumenInicial.costoProveedorEstimadoUsdTotal}</p>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Costo proveedor estimado</p>
            </Card>
          </div>
        ) : (
          <p className="text-[12px] text-text-faint">No se pudo cargar el resumen.</p>
        )}
        {resumenInicial && resumenInicial.consumoPorCategoria.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {resumenInicial.consumoPorCategoria.map((c) => (
              <li key={c.categoria} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-[12px]">
                <span className="text-text-muted">{c.categoria}</span>
                <span className="font-bold text-text">{c.creditos} créditos</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">AI Pricing Engine</h2>
        <div className="flex flex-col gap-2">
          {acciones.map((a) => (
            <FilaAccionCosto key={a.accion} accion={a} disabled={pendiente} onGuardar={guardarCosto} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Cost Optimizer — orden de proveedores</h2>
        <div className="flex flex-col gap-2">
          {modelos.map((m) => (
            <FilaModelo key={m.nombre} modelo={m} disabled={pendiente} onGuardar={guardarModelo} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Paquetes de recarga</h2>
        <div className="flex flex-col gap-2">
          {paquetes.map((p) => (
            <FilaPaquete key={p.id} paquete={p} disabled={pendiente} onGuardar={guardarPaquete} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Funciones de IA por Plan</h2>
        <div className="overflow-x-auto rounded-2xl border border-border-subtle">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-2 text-left">
                <th className="px-3 py-2 font-bold uppercase text-text-faint">Función</th>
                {PLANES.map((p) => (
                  <th key={p} className="px-3 py-2 text-center font-bold uppercase text-text-faint">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funcionesUnicas.map((funcion) => (
                <tr key={funcion} className="border-b border-border-subtle last:border-0">
                  <td className="px-3 py-2 text-text-muted">{funcion}</td>
                  {PLANES.map((plan) => (
                    <td key={plan} className="px-3 py-2 text-center">
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => alternarFuncion(plan, funcion)}
                        className={`h-4 w-4 rounded ${habilitado(plan, funcion) ? "bg-accent" : "bg-surface-2"}`}
                        aria-label={`${funcion} en ${plan}: ${habilitado(plan, funcion) ? "habilitado" : "deshabilitado"}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">AI Cost Simulator</h2>
        <SimuladorCosto />
      </section>
    </div>
  );
}

function FilaAccionCosto({ accion, disabled, onGuardar }: { accion: AccionCostoIa; disabled: boolean; onGuardar: (a: AccionCostoIa, costo: number, activo: boolean) => void }) {
  const [costo, setCosto] = useState(accion.costoCreditos);
  const [activo, setActivo] = useState(accion.activo);
  const cambio = costo !== accion.costoCreditos || activo !== accion.activo;
  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-text">{accion.accion}</p>
        <p className="text-[10.5px] text-text-faint">{accion.categoria} · Nivel {accion.nivelIa}</p>
      </div>
      <input
        type="number"
        min={0}
        value={costo}
        onChange={(e) => setCosto(Number(e.target.value))}
        className="w-20 rounded-lg border border-border bg-bg px-2 py-1 text-[12px] text-text"
      />
      <span className="text-[10.5px] text-text-faint">créditos</span>
      <button type="button" onClick={() => setActivo((v) => !v)}>
        <Badge tone={activo ? "success" : "neutral"}>{activo ? "Activo" : "Inactivo"}</Badge>
      </button>
      {cambio ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGuardar(accion, costo, activo)}
          className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold uppercase text-white disabled:opacity-50"
        >
          Guardar
        </button>
      ) : null}
    </Card>
  );
}

function FilaModelo({ modelo, disabled, onGuardar }: { modelo: ModeloIa; disabled: boolean; onGuardar: (m: ModeloIa, orden: number, activo: boolean) => void }) {
  const [orden, setOrden] = useState(modelo.ordenPreferencia);
  const [activo, setActivo] = useState(modelo.activo);
  const cambio = orden !== modelo.ordenPreferencia || activo !== modelo.activo;
  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-text">{modelo.nombre}</p>
        <p className="text-[10.5px] text-text-faint">{modelo.proveedor} · {modelo.modeloId}{modelo.requiereCredencial ? ` · requiere ${modelo.requiereCredencial}` : ""}</p>
      </div>
      <input
        type="number"
        min={1}
        value={orden}
        onChange={(e) => setOrden(Number(e.target.value))}
        className="w-16 rounded-lg border border-border bg-bg px-2 py-1 text-[12px] text-text"
      />
      <button type="button" onClick={() => setActivo((v) => !v)}>
        <Badge tone={activo ? "success" : "neutral"}>{activo ? "Activo" : "Inactivo"}</Badge>
      </button>
      {cambio ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGuardar(modelo, orden, activo)}
          className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold uppercase text-white disabled:opacity-50"
        >
          Guardar
        </button>
      ) : null}
    </Card>
  );
}

function FilaPaquete({ paquete, disabled, onGuardar }: { paquete: PaqueteIa; disabled: boolean; onGuardar: (p: PaqueteIa, precio: number | null, activo: boolean) => void }) {
  const [precio, setPrecio] = useState(paquete.precioCop);
  const [activo, setActivo] = useState(paquete.activo);
  const cambio = precio !== paquete.precioCop || activo !== paquete.activo;
  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-text">{paquete.nombre}</p>
        <p className="text-[10.5px] text-text-faint">{paquete.creditos ?? "A cotizar"} créditos</p>
      </div>
      {paquete.creditos !== null ? (
        <>
          <input
            type="number"
            min={0}
            value={precio ?? 0}
            onChange={(e) => setPrecio(Number(e.target.value))}
            className="w-28 rounded-lg border border-border bg-bg px-2 py-1 text-[12px] text-text"
          />
          <span className="text-[10.5px] text-text-faint">COP</span>
        </>
      ) : (
        <span className="text-[11px] text-text-faint">Enterprise — cotización manual, sin autoservicio</span>
      )}
      <button type="button" onClick={() => setActivo((v) => !v)}>
        <Badge tone={activo ? "success" : "neutral"}>{activo ? "Activo" : "Inactivo"}</Badge>
      </button>
      {cambio ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGuardar(paquete, precio, activo)}
          className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold uppercase text-white disabled:opacity-50"
        >
          Guardar
        </button>
      ) : null}
    </Card>
  );
}

function SimuladorCosto() {
  const [plan, setPlan] = useState<(typeof PLANES)[number]>("JARL");
  const [numStaff, setNumStaff] = useState(3);
  const [numClientes, setNumClientes] = useState(150);
  const [resultado, setResultado] = useState<SimulacionIa | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  function simular() {
    iniciarTransicion(async () => {
      const r = await simularConsumoIa(plan, numStaff, numClientes);
      if (!r.ok) { toast.error(r.error); return; }
      setResultado(r.data);
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase text-text-faint">Plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value as (typeof PLANES)[number])} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-[12px] text-text">
            {PLANES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase text-text-faint">Staff</span>
          <input type="number" min={0} value={numStaff} onChange={(e) => setNumStaff(Number(e.target.value))} className="w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-[12px] text-text" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase text-text-faint">Clientes</span>
          <input type="number" min={0} value={numClientes} onChange={(e) => setNumClientes(Number(e.target.value))} className="w-24 rounded-lg border border-border bg-bg px-2 py-1.5 text-[12px] text-text" />
        </label>
        <button type="button" disabled={pendiente} onClick={simular} className="rounded-lg bg-accent px-4 py-1.5 text-[11.5px] font-bold uppercase text-white disabled:opacity-50">
          Simular
        </button>
      </div>
      {resultado ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricaSim etiqueta="Créditos incluidos" valor={resultado.creditosIncluidosPlan ?? "Sin límite"} />
          <MetricaSim etiqueta="Consumo estimado" valor={resultado.creditosEstimadosConsumo} />
          <MetricaSim etiqueta="Excede el Plan" valor={resultado.excedeCreditosIncluidos ? "Sí" : "No"} />
          <MetricaSim etiqueta="Costo proveedor est." valor={`US$${resultado.costoProveedorEstimadoUsd}`} />
          <MetricaSim etiqueta="Margen promedio" valor={`${resultado.margenPctPromedio}%`} />
          <MetricaSim etiqueta="Precio/crédito prom." valor={formatCOP(resultado.precioPorCreditoPromedioCop)} />
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-text-faint">
          Heurística documentada (ADR-013): sin historial suficiente todavía, se estima 4 acciones/mes por Staff + 1 cada 20 Clientes/mes.
        </p>
      )}
    </Card>
  );
}

function MetricaSim({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-center">
      <p className="text-[15px] font-bold text-text">{valor}</p>
      <p className="text-[9.5px] font-bold uppercase tracking-wide text-text-faint">{etiqueta}</p>
    </div>
  );
}
