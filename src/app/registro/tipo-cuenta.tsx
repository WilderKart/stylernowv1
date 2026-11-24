"use client";

import { useT } from "@/lib/i18n/proveedor";
import { Store, User } from "lucide-react";
import s from "./tipo-cuenta.module.css";

export type TipoCuenta = "cliente" | "negocio";

/**
 * «¿QUÉ TIPO DE CUENTA QUIERES CREAR?» — grupo de radios nativos (teclado con flechas y lectores de
 * pantalla sin código extra) dibujados como tarjetas. La elección solo decide el recorrido: el
 * servidor la vuelve a validar y nunca la usa como permiso (ver src/lib/auth/destino-inicial.ts).
 */
export function SelectorTipoCuenta({
  valor,
  onChange,
  error,
  idError,
}: {
  valor: TipoCuenta | null;
  onChange: (v: TipoCuenta) => void;
  error?: boolean;
  idError?: string;
}) {
  const t = useT();
  const opciones = [
    { v: "cliente" as const, Icono: User, titulo: t("auth.tipo_cliente"), desc: t("auth.tipo_cliente_desc") },
    { v: "negocio" as const, Icono: Store, titulo: t("auth.tipo_negocio"), desc: t("auth.tipo_negocio_desc") },
  ];
  return (
    <fieldset className={s.grupo} aria-describedby={error ? idError : undefined} aria-invalid={error || undefined}>
      <legend className={s.pregunta}>{t("auth.tipo_pregunta")}</legend>
      <div className={s.tarjetas}>
        {opciones.map(({ v, Icono, titulo, desc }) => {
          const elegida = valor === v;
          return (
            <label key={v} className={[s.tarjeta, "sn-tipo-tarjeta", elegida ? `${s.elegida} is-elegida` : "", error ? s.conError : ""].join(" ")}>
              <input
                type="radio"
                name="tipo-cuenta"
                value={v}
                checked={elegida}
                onChange={() => onChange(v)}
                className={s.radio}
                required
              />
              <span className={`${s.indicador} sn-tipo-indicador`} aria-hidden />
              <Icono className={`${s.icono} sn-tipo-icono`} aria-hidden />
              <span className={`${s.titulo} sn-tipo-titulo`}>{titulo}</span>
              <span className={s.descripcion}>{desc}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
