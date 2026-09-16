"use client";

import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { consultarMiGiftCard, type ConsultaGiftCard } from "./actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral"> = {
  ACTIVA: "success",
  BLOQUEADA: "neutral",
  CANJEADA: "danger",
  VENCIDA: "danger",
};

export function VistaConsultarGiftCard() {
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ConsultaGiftCard | null>(null);

  async function consultar() {
    if (!codigo.trim() || !pin.trim()) return toast.error("Completá el código y el PIN.");
    setCargando(true);
    const r = await consultarMiGiftCard(codigo, pin);
    setCargando(false);
    if (!r.ok) { toast.error(r.error); setResultado(null); return; }
    setResultado(r.data);
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
      <p className="mb-5 text-[12.5px] text-text-muted">
        Verificá el código y el saldo de tu Gift Card. Para canjearla, presentala junto con el PIN en el local — el Staff la registra ahí.
      </p>

      <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Código</label>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        placeholder="Ej. A1B2C3D4E5"
        className="mb-4 h-10 w-full rounded-lg border border-border bg-bg px-3 text-[13px] uppercase text-text"
      />
      <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">PIN</label>
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        type="password"
        inputMode="numeric"
        placeholder="••••"
        className="mb-5 h-10 w-full rounded-lg border border-border bg-bg px-3 text-[13px] text-text"
      />
      <Button className="w-full" loading={cargando} onClick={consultar}>Consultar</Button>

      {resultado ? (
        <Card className="mt-6">
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-semibold text-text">{resultado.negocioNombre}</p>
            <Badge tone={ESTADO_TONO[resultado.estado] ?? "neutral"}>{resultado.estado}</Badge>
          </div>
          <p className="font-display mt-2 text-[26px] font-bold text-accent">{formatCOP(resultado.saldoActual)}</p>
          {resultado.saldoActual !== resultado.montoOriginal ? (
            <p className="text-[11.5px] text-text-faint">de {formatCOP(resultado.montoOriginal)} original</p>
          ) : null}
          {resultado.fechaExpiracion ? (
            <p className="mt-2 text-[11.5px] text-text-faint">Vence el {new Date(resultado.fechaExpiracion).toLocaleDateString("es-CO")}</p>
          ) : null}
        </Card>
      ) : null}
    </main>
  );
}
