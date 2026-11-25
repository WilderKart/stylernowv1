"use client";

import { ajustarSaldoCliente } from "@/app/panel/pagos/actions";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/ui/confirmar";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Saldo pendiente del cliente SOLO en este negocio (se cobra en su próxima cita/POS). Cualquiera con acceso al CRM lo ve;
 * ajustarlo o condonarlo es exclusivo del dueño (la base de datos lo vuelve a exigir) y siempre exige un motivo.
 */
export function SaldoPendienteCliente({ clienteId, saldo, puedeAjustar }: { clienteId: string; saldo: number; puedeAjustar: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"CONDONACION" | "ABONO" | "AJUSTE">("CONDONACION");
  const [nuevo, setNuevo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (saldo <= 0) return null;

  function aplicar() {
    setError(null);
    const valor = tipo === "CONDONACION" ? 0 : Number(nuevo.replace(/\D/g, ""));
    if (tipo !== "CONDONACION" && nuevo.trim() === "") return setError("Escribe el nuevo saldo.");
    if (motivo.trim().length < 10) return setError("Escribe un motivo de al menos 10 caracteres.");
    iniciar(async () => {
      const texto = tipo === "CONDONACION"
        ? `¿Condonar los ${formatCOP(saldo)} que debe este cliente? El saldo quedará en cero.`
        : `¿Cambiar el saldo de ${formatCOP(saldo)} a ${formatCOP(valor)}?`;
      if (!(await confirmar(texto, { titulo: "Ajustar saldo pendiente", confirmar: "Sí, aplicar" }))) return;
      const r = await ajustarSaldoCliente(clienteId, valor, motivo, tipo);
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <section className="mx-5 mt-4 border-2 border-danger bg-surface p-4" aria-label="Saldo pendiente del cliente">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold uppercase text-text-muted">Saldo pendiente en tu negocio</p>
          <p className="sn-price">{formatCOP(saldo)}</p>
          <p className="sn-meta">Se cobra automáticamente en su próxima cita (Caja). No bloquea sus reservas.</p>
        </div>
        {puedeAjustar && !abierto ? <Button variant="secondary" onClick={() => setAbierto(true)}>Ajustar / Condonar saldo</Button> : null}
      </div>
      {puedeAjustar && abierto ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Acción
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="h-10 border-2 border-border bg-bg px-2 text-[14px] text-text">
              <option value="CONDONACION">Condonar todo (dejar en cero)</option>
              <option value="ABONO">Registrar un abono (el cliente pagó una parte)</option>
              <option value="AJUSTE">Corregir el saldo</option>
            </select>
          </label>
          {tipo !== "CONDONACION" ? (
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Nuevo saldo (COP)
              <input inputMode="numeric" value={nuevo} onChange={(e) => setNuevo(e.target.value.replace(/\D/g, ""))} className="h-10 border-2 border-border bg-bg px-3 text-[14px] text-text" />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Motivo (obligatorio, queda en auditoría)
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={300} className="border-2 border-border bg-bg p-2 text-[14px] text-text" />
          </label>
          {error ? <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <Button variant="secondary" disabled={pendiente} onClick={() => { setAbierto(false); setError(null); }}>Cancelar</Button>
            <Button loading={pendiente} disabled={pendiente} onClick={aplicar}>Aplicar</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
