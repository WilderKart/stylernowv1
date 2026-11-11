"use client";

import { Segmented, Status } from "@/components/brutal";
import { lineasIncluye, llamadoAccion } from "@/lib/planes/etiquetas";
import { formatearMoneda } from "@/lib/planes/moneda";
import { calcularPrecio, type CicloFacturacion } from "@/lib/planes/precios";
import type { CatalogoPais, PlanCodigo } from "@/lib/planes/catalogo";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * Selector de planes del sistema brutalista. No contiene precios ni límites: todo viene del
 * catálogo leído de la BD (plan_precio, plan_caracteristica, pais). Reutilizado en el alta del
 * negocio (D01/D02) y en Plan y facturación (D19).
 */
export function SelectorPlanes({
  catalogo,
  value,
  onChange,
  ciclo,
  onCicloChange,
  deshabilitadoCodigos = [],
}: {
  catalogo: CatalogoPais;
  value: string | null;
  onChange: (codigo: PlanCodigo) => void;
  ciclo: CicloFacturacion;
  onCicloChange: (c: CicloFacturacion) => void;
  deshabilitadoCodigos?: string[];
}) {
  const { pais, planes } = catalogo;
  const hayCupos = pais.cuposFundadorRestantes > 0 && ciclo === "MENSUAL";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          aria-label="Ciclo de facturación"
          value={ciclo}
          onChange={onCicloChange}
          options={[
            { value: "MENSUAL", label: "Mensual" },
            { value: "ANUAL", label: `Anual · ${pais.mesesPagadosAnual} meses` },
          ]}
        />
        {pais.cuposFundadorRestantes > 0 ? (
          <Status tone="warn">
            Fundador −{pais.fundadorDescuentoPct}% · {pais.fundadorMeses} meses · quedan {pais.cuposFundadorRestantes} cupos
          </Status>
        ) : (
          <span className="sn-meta">Cupos fundador agotados en {pais.nombre}</span>
        )}
      </div>

      <div className="grid gap-3">
        {planes.map((p) => {
          const activo = value === p.codigo;
          const cotizar = p.precioMensual === null;
          const aplicaFundador = hayCupos && p.codigo !== "ALLFATHER" && !cotizar;
          const precio =
            p.precioMensual !== null
              ? calcularPrecio({
                  precioMensual: p.precioMensual,
                  ciclo,
                  mesesPagadosAnual: pais.mesesPagadosAnual,
                  descuentoFundadorPct: aplicaFundador ? pais.fundadorDescuentoPct : 0,
                })
              : null;
          const bloqueado = deshabilitadoCodigos.includes(p.codigo);
          const ventas = llamadoAccion(p) === "ventas";

          return (
            <button
              key={p.codigo}
              type="button"
              disabled={bloqueado}
              aria-pressed={activo}
              onClick={() => onChange(p.codigo)}
              className={cn(
                "flex flex-col gap-3 border-2 border-border p-4 text-left transition-[transform,box-shadow] duration-100",
                activo ? "bg-signal text-ink shadow-hard" : "bg-bg text-text active:translate-x-1 active:translate-y-1",
                bloqueado && "cursor-not-allowed border-dashed opacity-50",
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="poster-4 break-words">{p.nombre}</span>
                <span className="text-right">
                  {precio && p.precioMensual !== null ? (
                    <>
                      {precio.ahorro > 0 ? (
                        <span className="sn-meta block !text-current line-through">
                          {formatearMoneda(precio.lista, pais.moneda, pais.locale)}
                        </span>
                      ) : null}
                      <span className="figure-md block">
                        {p.esDesde ? "desde " : ""}
                        {formatearMoneda(precio.final, pais.moneda, pais.locale)}
                      </span>
                      <span className="sn-meta !text-current">
                        {ciclo === "ANUAL" ? "/año" : "/mes"}
                        {pais.precioMasImpuesto ? " + IVA" : ""}
                      </span>
                    </>
                  ) : (
                    <span className="sn-label">A cotizar</span>
                  )}
                </span>
              </span>

              <ul className="grid gap-1.5">
                {lineasIncluye(p).map((l) => (
                  <li key={l} className="flex items-start gap-2 text-[13px] leading-[18px]">
                    <Check className="mt-0.5 !size-4 shrink-0" aria-hidden />
                    {l}
                  </li>
                ))}
              </ul>

              <span className="sn-label">{ventas ? "Hablar con ventas" : "Probar 14 días"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
