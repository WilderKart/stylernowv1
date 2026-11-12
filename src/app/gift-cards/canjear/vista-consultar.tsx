"use client";

import { ErrorAviso, TicketCita } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { Check, Clock, X } from "lucide-react";
import { useState } from "react";
import { consultarMiGiftCard, type ConsultaGiftCard } from "./actions";
import { useIdioma, useT } from "@/lib/i18n/proveedor";

const ESTADO_TONO: Record<string, "ok" | "warn" | "err" | "info"> = {
  ACTIVA: "ok",
  BLOQUEADA: "warn",
  CANJEADA: "info",
  VENCIDA: "err",
};

export function VistaConsultarGiftCard() {
  const t = useT();
  const loc = useIdioma() === "en" ? "en-US" : "es-CO";
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ConsultaGiftCard | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim() || !pin.trim()) {
      setError(t("gc.completa"));
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
        {t("gc.verifica_txt")}
      </p>

      <form onSubmit={consultar} className="flex flex-col gap-4">
        <Input
          label={t("gc.codigo")}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder={t("gc.codigo_ph")}
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
          {t("gc.consultar_btn")}
        </Button>
      </form>

      {resultado ? (
        <TicketCita
          dia={resultado.montoOriginal >= 1000 ? String(Math.round(resultado.montoOriginal / 1000)) : String(resultado.montoOriginal)}
          mes={resultado.montoOriginal >= 1000 ? t("gc.mil") : "COP"}
          estado={
            <Status tone={tono} icon={<Icono aria-hidden className="size-3.5" />}>
              {resultado.estado}
            </Status>
          }
          titulo={t("gc.titulo_negocio", { negocio: resultado.negocioNombre })}
          lineas={[
            resultado.fechaExpiracion ? t("gc.vence", { fecha: new Date(resultado.fechaExpiracion).toLocaleDateString(loc) }) : null,
          ].filter(Boolean)}
          pie={
            <>
              <span className="sn-label">
                {resultado.saldoActual !== resultado.montoOriginal ? t("gc.saldo_de", { monto: formatCOP(resultado.montoOriginal) }) : t("gc.saldo")}
              </span>
              <span className="sn-price">{formatCOP(resultado.saldoActual)}</span>
            </>
          }
        />
      ) : null}
    </main>
  );
}
