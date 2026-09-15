"use client";

import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import type { MovimientoWallet, WalletResumen } from "./actions";

const TIPO_ETIQUETA: Record<string, string> = {
  COMISION: "Cobro acreditado",
  REEMBOLSO_COMISION: "Reversión por reembolso",
  CAMPANA: "Campaña publicitaria",
  RETIRO: "Retiro",
  AJUSTE: "Ajuste",
};

const TIPO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  COMISION: "success",
  REEMBOLSO_COMISION: "danger",
  CAMPANA: "accent",
  RETIRO: "neutral",
  AJUSTE: "neutral",
};

export function VistaWallet({
  walletInicial,
  movimientosIniciales,
}: {
  walletInicial: WalletResumen;
  movimientosIniciales: MovimientoWallet[];
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Mi Wallet</h1>
      <p className="mb-6 text-[12px] text-text-faint">
        Saldo neto de comisión de plataforma ya descontada. El pago físico a tu Staff ocurre fuera de StylerNow.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-[22px] font-bold text-text">{formatCOP(walletInicial.saldoDisponible)}</p>
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Saldo disponible</p>
        </Card>
        <Card className="text-center">
          <p className="text-[22px] font-bold text-text">{formatCOP(walletInicial.saldoRetenido)}</p>
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Saldo retenido</p>
        </Card>
      </div>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Movimientos</h2>
        {movimientosIniciales.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Todavía no hay movimientos en tu Wallet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {movimientosIniciales.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] font-semibold text-text">{TIPO_ETIQUETA[m.tipo] ?? m.tipo}</p>
                    <Badge tone={TIPO_TONO[m.tipo] ?? "neutral"}>{m.tipo.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="text-[11px] text-text-faint">{new Date(m.createdAt).toLocaleString("es-CO")}</p>
                </div>
                <p className={`shrink-0 text-[13px] font-bold ${m.monto >= 0 ? "text-success" : "text-danger"}`}>
                  {m.monto >= 0 ? "+" : ""}
                  {formatCOP(m.monto)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
