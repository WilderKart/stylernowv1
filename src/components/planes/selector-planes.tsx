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
  compacto = false,
  diasPrueba = 14,
}: {
  catalogo: CatalogoPais;
  value: string | null;
  onChange: (codigo: PlanCodigo) => void;
  ciclo: CicloFacturacion;
  onCicloChange: (c: CicloFacturacion) => void;
  deshabilitadoCodigos?: string[];
  /** Tarjetas compactas: lo incluido va en un desplegable «Ver lo que incluye» (alta del negocio). */
  compacto?: boolean;
  /** Días de la prueba según la configuración del servidor (solo para el rótulo). */
  diasPrueba?: number;
}) {
  const { pais, planes } = catalogo;
  const hayCupos = pais.cuposFundadorRestantes > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          aria-label="Ciclo de facturación"
          value={ciclo}
          onChange={onCicloChange}
          options={[
            { value: "MENSUAL", label: "Mensual" },
            { value: "ANUAL", label: pais.mesesPagadosAnual < 12 ? `Anual · ${12 - pais.mesesPagadosAnual} meses gratis` : "Anual" },
          ]}
        />
        {pais.cuposFundadorRestantes > 0 ? (
          <Status tone="warn">
            {ciclo === "ANUAL"
              ? `Fundador −${pais.fundadorDescuentoPct}% solo el primer mes`
              : `Fundador −${pais.fundadorDescuentoPct}% · ${pais.fundadorMeses} meses`}{" "}
            · quedan {pais.cuposFundadorRestantes} cupos
          </Status>
        ) : (
          <span className="sn-meta">Cupos fundador agotados en {pais.nombre}</span>
        )}
      </div>

      {ciclo === "ANUAL" && pais.mesesPagadosAnual < 12 ? (
        <p className="sn-meta">Promoción de lanzamiento: puede cambiar o retirarse sin previo aviso. No cambia lo ya pagado.</p>
      ) : null}

      <div className="grid gap-3">
        {planes.map((p) => {
          const activo = value === p.codigo;
          const cotizar = p.precioMensual === null;
          const aplicaFundador = hayCupos && p.codigo !== "SIGNATURE" && !cotizar;
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

          if (compacto) {
            return (
              <div
                key={p.codigo}
                className={cn(
                  "border-2 border-border bg-bg text-left transition-[transform,box-shadow] duration-100",
                  activo && "shadow-hard",
                  bloqueado && "border-dashed opacity-50",
                )}
              >
                <button
                  type="button"
                  disabled={bloqueado}
                  aria-pressed={activo}
                  onClick={() => onChange(p.codigo)}
                  className={cn("sn-card-btn flex w-full items-start gap-3 p-4 text-left", activo ? "bg-signal text-ink" : "bg-bg text-text")}
                >
                  <span
                    aria-hidden
                    className={cn("mt-1 flex size-5 shrink-0 items-center justify-center border-2", activo ? "border-ink bg-ink text-signal" : "border-border")}
                  >
                    {activo ? <Check className="!size-3.5" /> : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="poster-5 break-words font-display uppercase">{p.nombre}</span>
                      <span className="text-right">
                        {precio && p.precioMensual !== null ? (
                          <span className="block">
                            {aplicaFundador && precio.ahorro > 0 ? (
                              <span className="sn-meta block !text-current line-through">
                                {formatearMoneda(precio.lista, pais.moneda, pais.locale)}
                              </span>
                            ) : null}
                            <span className="figure-md">
                              {p.esDesde ? "desde " : ""}
                              {formatearMoneda(precio.final, pais.moneda, pais.locale)}
                            </span>
                            <span className="sn-meta !text-current"> {ciclo === "ANUAL" ? "/año" : "/mes"}</span>
                          </span>
                        ) : (
                          <span className="sn-label">A cotizar</span>
                        )}
                      </span>
                    </span>
                    <span className="text-[12.5px] leading-[17px]">
                      {[
                        p.staffIncluido != null ? `${p.staffIncluido} ${p.staffIncluido === 1 ? "profesional" : "profesionales"}` : null,
                        p.limiteSedes != null ? `${p.limiteSedes} ${p.limiteSedes === 1 ? "sede" : "sedes"}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
                <details className="group border-t-2 border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-text">
                    Ver lo que incluye
                    <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <ul className="grid gap-1.5 px-4 pb-4">
                    {lineasIncluye(p).map((l) => (
                      <li key={l} className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                        <Check className="mt-0.5 !size-4 shrink-0 text-accent" aria-hidden />
                        {l}
                      </li>
                    ))}
                  </ul>
                </details>
                {activo && !ventas ? (
                  <p className="border-t-2 border-border bg-accent-soft px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide text-text">
                    Probar {diasPrueba} días gratis
                  </p>
                ) : null}
              </div>
            );
          }

          return (
            <button
              key={p.codigo}
              type="button"
              disabled={bloqueado}
              aria-pressed={activo}
              onClick={() => onChange(p.codigo)}
              className={cn(
                "sn-card-btn flex flex-col gap-3 border-2 border-border p-4 text-left transition-[transform,box-shadow] duration-100",
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

              <span className="sn-label">{ventas ? "Hablar con ventas" : `Probar ${diasPrueba} días`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
