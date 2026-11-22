"use client";

import { Button } from "@/components/ui/button";
import type { EstadoVerificacion } from "@/lib/verificacion/tipos";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { decidirVerificacion } from "../actions";

type Decision = "VERIFICADA" | "REQUIERE_CORRECCION" | "RECHAZADA" | "REVOCADA";

const OPCIONES: Record<string, { valor: Decision; etiqueta: string }[]> = {
  EN_REVISION: [
    { valor: "VERIFICADA", etiqueta: "Verificar" },
    { valor: "REQUIERE_CORRECCION", etiqueta: "Pedir corrección" },
    { valor: "RECHAZADA", etiqueta: "Rechazar" },
  ],
  VERIFICADA: [{ valor: "REVOCADA", etiqueta: "Revocar verificación" }],
};

/** Decisión con motivo obligatorio. El servidor y la base de datos validan de nuevo el estado y el permiso. */
export function FormularioDecision({ negocioId, estado }: { negocioId: string; estado: EstadoVerificacion }) {
  const router = useRouter();
  const opciones = OPCIONES[estado] ?? [];
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (opciones.length === 0) {
    return (
      <p className="border-2 border-dashed border-border px-3 py-3 text-[12.5px] text-text-muted">
        No hay decisiones disponibles en este estado. {estado === "EN_REVISION" ? "" : "Solo se decide cuando el negocio envía la verificación a revisión, o para revocar una verificación vigente."}
      </p>
    );
  }

  async function decidir(valor: Decision) {
    setError(null);
    if (motivo.trim().length < 10) return setError("Escribe el motivo de la decisión (mínimo 10 caracteres).");
    if (!window.confirm("¿Confirmas esta decisión? Quedará registrada con tu usuario y el motivo.")) return;
    setOcupado(valor);
    const r = await decidirVerificacion({ negocioId, nuevo: valor, motivo });
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    setMotivo("");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 border-2 border-ink p-4 shadow-hard dark:border-border" aria-label="Decisión">
      <h2 className="font-display text-[14px] font-bold uppercase text-text">Decisión</h2>
      <label className="flex flex-col gap-2">
        <span className="sn-label">Motivo (lo verá el negocio si pides corrección, rechazas o revocas)</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full border-2 border-border bg-bg px-3 py-2.5 text-[14px] text-text outline-none focus:shadow-hard"
        />
      </label>
      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <Button
            key={o.valor}
            size="sm"
            variant={o.valor === "VERIFICADA" ? "primary" : "danger"}
            loading={ocupado === o.valor}
            disabled={ocupado !== null}
            onClick={() => decidir(o.valor)}
          >
            {o.etiqueta}
          </Button>
        ))}
      </div>
    </section>
  );
}
