"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Check } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { cambiarConsentimientoMarcas } from "./actions";

/** Casilla APARTE, opcional y nunca premarcada: parte del estado real guardado en la BD. */
export function CasillaMarcas({ activoInicial }: { activoInicial: boolean }) {
  const [activo, setActivo] = useState(activoInicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function alternar(nuevo: boolean) {
    setError(null);
    setActivo(nuevo);
    iniciar(async () => {
      const r = await cambiarConsentimientoMarcas(nuevo);
      if (!r.ok) {
        setActivo(!nuevo);
        setError(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 px-4">
      <label className="flex min-h-12 cursor-pointer items-start gap-3 py-2">
        <input
          type="checkbox"
          checked={activo}
          disabled={pendiente}
          onChange={(e) => alternar(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`grid size-6 shrink-0 place-items-center border-2 border-line peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${activo ? "bg-signal text-ink" : "bg-bg"}`}
        >
          {activo ? <Check className="size-4" strokeWidth={3} /> : null}
        </span>
        <span className="body-sm min-w-0 break-words">
          Quiero recibir beneficios de marcas aliadas de cuidado personal. Compartimos solo tu nombre y ciudad, nunca tu teléfono ni tu correo. Puedes retirarlo en{" "}
          <Link href="/privacidad" className="underline">
            Privacidad ↗
          </Link>
        </span>
      </label>
      {error ? <ErrorAviso>{error}</ErrorAviso> : null}
    </div>
  );
}
