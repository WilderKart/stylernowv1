"use client";

import { ErrorAviso, TicketCita } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { Check, Clock, X } from "lucide-react";
import { useState } from "react";
import { consultarMiGiftCard, type ConsultaGiftCard } from "./actions";

const ESTADO_TONO: Record<string, "ok" | "warn" | "err" | "info"> = {
  ACTIVA: "ok",
  BLOQUEADA: "warn",
  CANJEADA: "info",
  VENCIDA: "err",
};

export function VistaConsultarGiftCard() {
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ConsultaGiftCard | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim() || !pin.trim()) {
      setError("Completa el código y el PIN.");
      return;
    }
    setCargando(true);
    setError(null);
    const r = await consultarMiGiftCard(codigo, pin);
    setCargando(false);
    if (!r.ok) {
      setError(r.error);
      setResultado(null);
      return;
    }
    setResultado(r.data);
  }

  const tono = resultado ? (ESTADO_TONO[resultado.estado] ?? "info") : "info";
  const Icono = tono === "ok" ? Check : tono === "err" ? X : Clock;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <p className="body-sm break-words">
        Verifica el código y el saldo de tu gift card. Para canjearla, preséntala junto con el PIN en el local: el staff la
        registra ahí.
      </p>

      <form onSubmit={consultar} className="flex flex-col gap-4">
        <Input
          label="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="Ej. A1B2C3D4E5"
          autoCapitalize="characters"
        />
        <Input
          label="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          placeholder="••••"
        />
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        <Button type="submit" size="lg" className="w-full" loading={cargando}>
          Consultar
        </Button>
      </form>

      {resultado ? (
        <TicketCita
          dia={resultado.montoOriginal >= 1000 ? String(Math.round(resultado.montoOriginal / 1000)) : String(resultado.montoOriginal)}
          mes={resultado.montoOriginal >= 1000 ? "Mil" : "COP"}
          estado={
            <Status tone={tono} icon={<Icono aria-hidden className="size-3.5" />}>
              {resultado.estado}
            </Status>
          }
          titulo={`Gift card · ${resultado.negocioNombre}`}
          lineas={[
            resultado.fechaExpiracion ? `Vence el ${new Date(resultado.fechaExpiracion).toLocaleDateString("es-CO")}` : null,
          ].filter(Boolean)}
          pie={
            <>
              <span className="sn-label">
                Saldo{resultado.saldoActual !== resultado.montoOriginal ? ` · de ${formatCOP(resultado.montoOriginal)}` : ""}
              </span>
              <span className="sn-price">{formatCOP(resultado.saldoActual)}</span>
            </>
          }
        />
      ) : null}
    </main>
  );
}
