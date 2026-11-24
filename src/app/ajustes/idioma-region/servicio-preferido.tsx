"use client";

import { useT } from "@/lib/i18n/proveedor";
import { OPCIONES_SERVICIO_REGISTRO, esCategoriaRegistro, type CategoriaRegistro } from "@/lib/tema/vertical";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { guardarServicioPreferido } from "./servicio-actions";

/** «Servicio que buscas»: adapta el aspecto de la portada del cliente. Se puede cambiar o quitar cuando quiera. */
export function ServicioPreferido({ inicial }: { inicial: string | null }) {
  const t = useT();
  const router = useRouter();
  const [valor, setValor] = useState<CategoriaRegistro | null>(esCategoriaRegistro(inicial) ? inicial : null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(nuevo: CategoriaRegistro | null) {
    const anterior = valor;
    setValor(nuevo);
    setGuardando(true);
    setError(null);
    const r = await guardarServicioPreferido(nuevo);
    setGuardando(false);
    if (!r.ok) {
      setValor(anterior);
      return setError(r.error);
    }
    router.refresh();
  }

  return (
    <fieldset className="flex flex-col gap-3" disabled={guardando}>
      <legend className="sn-label mb-1">{t("auth.cat_cli_p")}</legend>
      <div role="radiogroup" aria-label={t("auth.cat_cli_p")} className="flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={valor === null} onClick={() => void elegir(null)} className={`sn-chip ${valor === null ? "is-selected !bg-signal !text-ink" : ""}`}>
          Todos
        </button>
        {OPCIONES_SERVICIO_REGISTRO.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            onClick={() => void elegir(o.valor)}
            className={`sn-chip ${valor === o.valor ? "is-selected !bg-signal !text-ink" : ""}`}
          >
            {t(o.clave)}
          </button>
        ))}
      </div>
      <p className="text-[12.5px] leading-relaxed text-text-muted">{t("auth.cat_cli_n")}</p>
      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
