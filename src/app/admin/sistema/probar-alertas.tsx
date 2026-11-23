"use client";

import { BellRing } from "lucide-react";
import { useState } from "react";

type Estado = "inicial" | "enviando" | "enviada" | "sin_destino" | "fallida" | "error";

export function ProbarAlertas() {
  const [estado, setEstado] = useState<Estado>("inicial");

  async function probar() {
    setEstado("enviando");
    try {
      const respuesta = await fetch("/api/monitoring/alerta-prueba", { method: "POST" });
      if (respuesta.status === 401 || respuesta.status === 403) {
        setEstado("error");
        return;
      }
      const cuerpo = (await respuesta.json()) as { resultado?: string };
      setEstado(cuerpo.resultado === "enviada" ? "enviada" : cuerpo.resultado === "sin_destino" ? "sin_destino" : "fallida");
    } catch {
      setEstado("fallida");
    }
  }

  const mensaje =
    estado === "enviando"
      ? "Enviando alerta de prueba…"
      : estado === "enviada"
        ? "Alerta enviada y aceptada por el canal configurado."
        : estado === "sin_destino"
          ? "No hay ALERTAS_WEBHOOK_URL configurada; la alerta quedó registrada en Sentry."
          : estado === "fallida"
            ? "El canal de alertas no respondió correctamente."
            : estado === "error"
              ? "No tienes permiso para disparar la alerta."
              : "Dispara una alerta de prueba para comprobar que el canal de guardia la recibe.";

  return (
    <div className="mt-4 flex flex-col gap-3 border-2 border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p role="status" className="text-[12.5px] text-text-muted">
        {mensaje}
      </p>
      <button
        type="button"
        onClick={probar}
        disabled={estado === "enviando"}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border-2 border-border px-3.5 font-mono text-[11.5px] font-bold uppercase text-text hover:bg-text hover:text-bg disabled:opacity-50"
      >
        <BellRing className="size-4" aria-hidden /> Probar alerta
      </button>
    </div>
  );
}
