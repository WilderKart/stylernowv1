"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { responderInvitacion } from "./actions";

const ESTADO_TEXTO: Record<string, string> = {
  ACEPTADA: "Ya aceptaste esta invitación.",
  RECHAZADA: "Ya rechazaste esta invitación.",
  CANCELADA: "Quien te invitó canceló esta invitación.",
  EXPIRADA: "Esta invitación expiró.",
};

export function RespuestaInvitacion({
  invitacionId,
  estado,
  expirada,
}: {
  invitacionId: string;
  estado: string;
  expirada: boolean;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<"aceptar" | "rechazar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rechazada, setRechazada] = useState(false);

  if (estado !== "PENDIENTE" || rechazada) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-6 text-[12.5px] text-text-faint">
        {rechazada ? "Rechazaste esta invitación." : ESTADO_TEXTO[estado] ?? "Esta invitación ya no está disponible."}
      </p>
    );
  }

  if (expirada) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-6 text-[12.5px] text-text-faint">
        Esta invitación expiró. Pedile a quien te invitó que te envíe una nueva.
      </p>
    );
  }

  async function onResponder(aceptar: boolean) {
    setEnviando(aceptar ? "aceptar" : "rechazar");
    setError(null);
    const res = await responderInvitacion(invitacionId, aceptar);
    setEnviando(null);
    if (!res.ok) return setError(res.error);
    if (aceptar) router.push("/panel");
    else setRechazada(true);
  }

  return (
    <div className="mt-6">
      {error ? <p className="mb-3 text-[12.5px] font-semibold text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          loading={enviando === "rechazar"}
          disabled={enviando !== null}
          onClick={() => onResponder(false)}
        >
          Rechazar
        </Button>
        <Button
          className="flex-1"
          loading={enviando === "aceptar"}
          disabled={enviando !== null}
          onClick={() => onResponder(true)}
        >
          Aceptar
        </Button>
      </div>
    </div>
  );
}
