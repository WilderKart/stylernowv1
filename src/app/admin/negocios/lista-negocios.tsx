"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useState } from "react";
import {
  aprobarNegocio,
  cancelarNegocio,
  forzarReactivacionPagoExterno,
  listarNegocios,
  marcarNegocioEnMora,
  reactivarNegocio,
  rechazarNegocio,
  suspenderNegocio,
  type NegocioAdmin,
} from "../actions";

const SUSCRIPCION_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  ACTIVA: "success",
  EN_MORA: "accent",
  SUSPENDIDA: "danger",
  CANCELADA: "neutral",
};

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  PENDIENTE_APROBACION: "accent",
  ACTIVO: "success",
  SUSPENDIDO: "danger",
  RECHAZADO: "neutral",
  CANCELADO: "neutral",
};

const FILTROS = [
  { valor: "", etiqueta: "Todos" },
  { valor: "PENDIENTE_APROBACION", etiqueta: "Pendientes" },
  { valor: "ACTIVO", etiqueta: "Activos" },
  { valor: "SUSPENDIDO", etiqueta: "Suspendidos" },
  { valor: "RECHAZADO", etiqueta: "Rechazados" },
  { valor: "CANCELADO", etiqueta: "Cancelados" },
] as const;

export function ListaNegocios({ negociosIniciales, errorInicial }: { negociosIniciales: NegocioAdmin[]; errorInicial: string | null }) {
  const [negocios, setNegocios] = useState(negociosIniciales);
  const [filtro, setFiltro] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(errorInicial);
  const [accionando, setAccionando] = useState<string | null>(null);

  async function onFiltrar(nuevoFiltro: string) {
    setFiltro(nuevoFiltro);
    setCargando(true);
    setError(null);
    const res = await listarNegocios(nuevoFiltro || undefined);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setNegocios(res.data);
  }

  async function ejecutar(negocioId: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setAccionando(negocioId);
    setError(null);
    const res = await fn();
    setAccionando(null);
    if (!res.ok) return setError(res.error ?? "Error inesperado.");
    onFiltrar(filtro);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => onFiltrar(f.valor)}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
              filtro === f.valor ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {cargando ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : negocios.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          No hay negocios en ese estado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {negocios.map((n) => (
            <li key={n.id} className="rounded-2xl border border-border-subtle bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-text">{n.nombre}</p>
                  <p className="text-[11.5px] text-text-faint">
                    {n.ciudad} · {n.planCodigo} · {new Date(n.createdAt).toLocaleDateString("es-CO")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={ESTADO_TONO[n.estado] ?? "neutral"}>{n.estado}</Badge>
                  {n.suscripcionEstado && n.suscripcionEstado !== "ACTIVA" ? (
                    <Badge tone={SUSCRIPCION_TONO[n.suscripcionEstado] ?? "neutral"}>
                      {n.suscripcionEstado}{n.suscripcionCausa ? ` · ${n.suscripcionCausa}` : ""}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {n.estado === "PENDIENTE_APROBACION" ? (
                  <>
                    <Button size="sm" loading={accionando === n.id} onClick={() => ejecutar(n.id, () => aprobarNegocio(n.id))}>
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={accionando === n.id}
                      onClick={() => {
                        const motivo = prompt("Motivo del rechazo:");
                        if (motivo) ejecutar(n.id, () => rechazarNegocio(n.id, motivo));
                      }}
                    >
                      Rechazar
                    </Button>
                  </>
                ) : null}
                {n.estado === "ACTIVO" && n.suscripcionEstado === "ACTIVA" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={accionando === n.id}
                    onClick={() => {
                      const motivo = prompt("Motivo (ej. la pasarela reportó un cobro fallido):");
                      if (motivo) ejecutar(n.id, () => marcarNegocioEnMora(n.id, motivo));
                    }}
                  >
                    Marcar en mora
                  </Button>
                ) : null}
                {n.suscripcionEstado === "EN_MORA" || (n.suscripcionEstado === "SUSPENDIDA" && n.suscripcionCausa === "IMPAGO") ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={accionando === n.id}
                    onClick={() => {
                      const motivo = prompt("Motivo (ej. pagó por transferencia manual verificada):");
                      if (motivo) ejecutar(n.id, () => forzarReactivacionPagoExterno(n.id, motivo));
                    }}
                  >
                    Forzar reactivación (pago externo)
                  </Button>
                ) : null}
                {n.estado === "ACTIVO" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={accionando === n.id}
                    onClick={() => {
                      const motivo = prompt("Motivo de la suspensión:");
                      if (motivo) ejecutar(n.id, () => suspenderNegocio(n.id, motivo, "INFRACCION"));
                    }}
                  >
                    Suspender
                  </Button>
                ) : null}
                {n.estado === "SUSPENDIDO" ? (
                  <Button size="sm" variant="secondary" loading={accionando === n.id} onClick={() => ejecutar(n.id, () => reactivarNegocio(n.id))}>
                    Reactivar
                  </Button>
                ) : null}
                {(n.estado === "ACTIVO" || n.estado === "SUSPENDIDO") ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={accionando === n.id}
                    onClick={() => {
                      const motivo = prompt("Motivo de la baja definitiva:");
                      if (motivo && confirm("¿Dar de baja este negocio de forma definitiva? No se puede revertir.")) {
                        ejecutar(n.id, () => cancelarNegocio(n.id, motivo));
                      }
                    }}
                  >
                    Dar de baja
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
