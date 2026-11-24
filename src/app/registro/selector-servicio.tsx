"use client";

import { OPCIONES_SERVICIO_REGISTRO, type CategoriaRegistro } from "@/lib/tema/vertical";
import { useT } from "@/lib/i18n/proveedor";
import type { TipoCuenta } from "./tipo-cuenta";

/**
 * Segunda pregunta de «Crear cuenta», según el tipo elegido:
 *  · negocio → «¿Qué tipo de negocio tienes?» (obligatoria: prepara el alta y el diseño de su panel)
 *  · cliente → «¿Qué servicio buscas?» (opcional: adapta la app a lo que busca)
 * Como el tipo de cuenta, solo decide el recorrido y el aspecto; el servidor la valida y nunca la usa como permiso.
 */
export function SelectorServicio({
  tipo,
  valor,
  onChange,
  error,
  idError,
}: {
  tipo: TipoCuenta;
  valor: CategoriaRegistro | null;
  onChange: (v: CategoriaRegistro | null) => void;
  error?: boolean;
  idError?: string;
}) {
  const t = useT();
  const esNegocio = tipo === "negocio";

  return (
    <fieldset className="flex flex-col gap-2.5 border-0 p-0" aria-describedby={error ? idError : undefined} aria-invalid={error || undefined} id="servicio-registro">
      <legend className="sn-label mb-1.5">{esNegocio ? t("auth.cat_neg_p") : t("auth.cat_cli_p")}</legend>
      <div role="radiogroup" aria-label={esNegocio ? t("auth.cat_neg_p") : t("auth.cat_cli_p")} className="flex flex-wrap gap-2">
        {OPCIONES_SERVICIO_REGISTRO.map((o) => {
          const elegida = valor === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={elegida}
              // En cliente se puede quitar la elección volviendo a tocarla (es opcional).
              onClick={() => onChange(elegida && !esNegocio ? null : o.valor)}
              className={`sn-chip ${elegida ? "is-selected !bg-signal !text-ink" : ""} ${error ? "!border-danger" : ""}`}
            >
              {t(o.clave)}
            </button>
          );
        })}
      </div>
      <p className="text-[12.5px] leading-relaxed text-text-muted">{esNegocio ? t("auth.cat_neg_n") : t("auth.cat_cli_n")}</p>
    </fieldset>
  );
}
