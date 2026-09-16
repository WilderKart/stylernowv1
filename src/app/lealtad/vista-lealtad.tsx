"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import { crearGrupoFamiliar, redimirGiftCard, registrarEventoFraude, registrarReferido, type ResumenLealtad } from "./actions";

const TIPO_ETIQUETA: Record<string, string> = {
  GIFT_CARD: "Gift Card",
  REFERIDO: "Referido",
  CASHBACK: "Cashback",
  PROMOCION: "Promoción",
  SELLO_CONVERTIDO: "Sello convertido",
  VIP_BONO: "Bono VIP",
  CANJE: "Canje",
};

export function VistaLealtad({ resumenInicial, errorInicial }: { resumenInicial: ResumenLealtad; errorInicial: string | null }) {
  const [resumen, setResumen] = useState(resumenInicial);
  const error = errorInicial;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
      <h1 className="font-display mb-4 text-base font-semibold uppercase tracking-wide text-text">Mi Lealtad</h1>
      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      <Card className="mb-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-faint">StylerWallet</p>
        <p className="mt-1 text-[28px] font-bold text-text">{formatCOP(resumen.walletSaldo)}</p>
        <p className="mt-1 text-[11px] text-text-faint">Gift Cards, Referidos, Cashback y Promociones — todo en un solo saldo, usable en cualquier Negocio que lo acepte.</p>
      </Card>

      <SeccionGiftCard onCanjeada={(saldo) => setResumen((r) => ({ ...r, walletSaldo: saldo }))} />

      {resumen.movimientos.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display mb-2 text-[12px] font-bold uppercase text-text">Movimientos recientes</h2>
          <ul className="flex flex-col gap-1.5">
            {resumen.movimientos.slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3 py-2">
                <div>
                  <p className="text-[12px] font-semibold text-text">{TIPO_ETIQUETA[m.tipo] ?? m.tipo}</p>
                  <p className="text-[10.5px] text-text-faint">{new Date(m.createdAt).toLocaleDateString("es-CO")}{m.motivo ? ` · ${m.motivo}` : ""}</p>
                </div>
                <p className={`shrink-0 text-[12.5px] font-bold ${m.monto >= 0 ? "text-success" : "text-danger"}`}>
                  {m.monto >= 0 ? "+" : ""}{formatCOP(m.monto)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SeccionReferidos codigoReferido={resumen.codigoReferido} referidos={resumen.referidos} />

      {resumen.sellos.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display mb-2 text-[12px] font-bold uppercase text-text">Sellos</h2>
          <ul className="flex flex-col gap-2">
            {resumen.sellos.map((s) => (
              <li key={s.campanaId} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
                <p className="text-[12.5px] font-semibold text-text">{s.negocioNombre} · {s.campanaNombre}</p>
                <Progress value={Math.min(100, (s.sellosActuales / s.sellosRequeridos) * 100)} className="mt-1.5 h-2" />
                <p className="mt-1 text-[10.5px] text-text-faint">{s.sellosActuales} de {s.sellosRequeridos} — {s.recompensaDescripcion}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {resumen.cashback.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display mb-2 text-[12px] font-bold uppercase text-text">Cashback</h2>
          <ul className="flex flex-col gap-1.5">
            {resumen.cashback.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3 py-2">
                <p className="text-[12px] text-text-muted">{c.negocioNombre}</p>
                <div className="flex items-center gap-2">
                  <Badge tone={c.estado === "DISPONIBLE" ? "success" : "neutral"}>{c.estado}</Badge>
                  <p className="text-[12.5px] font-bold text-text">{formatCOP(c.monto)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SeccionFamilia familia={resumen.familia} onCreada={() => window.location.reload()} />
    </main>
  );
}

function SeccionGiftCard({ onCanjeada }: { onCanjeada: (saldo: number) => void }) {
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function onCanjear() {
    if (!codigo.trim() || !pin.trim()) return;
    setCargando(true);
    setMensaje(null);
    const res = await redimirGiftCard(codigo, pin);
    setCargando(false);
    if (!res.ok) {
      if (res.error.includes("PIN no es correcto")) {
        await registrarEventoFraude("CANJE_DUPLICADO", null, { motivo: "PIN_INCORRECTO" });
      }
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    setMensaje({ tipo: "ok", texto: `¡Listo! Nuevo saldo: ${formatCOP(res.data.saldoDisponible)}` });
    setCodigo("");
    setPin("");
    onCanjeada(res.data.saldoDisponible);
  }

  return (
    <Card className="mb-6">
      <h2 className="font-display mb-2 text-[12px] font-bold uppercase text-text">Canjear Gift Card</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Código" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
        <Input placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} type="password" />
        <Button size="sm" loading={cargando} onClick={onCanjear} disabled={!codigo.trim() || !pin.trim()}>
          Canjear
        </Button>
      </div>
      {mensaje ? <p className={`mt-2 text-[12px] font-semibold ${mensaje.tipo === "ok" ? "text-success" : "text-danger"}`}>{mensaje.texto}</p> : null}
    </Card>
  );
}

function SeccionReferidos({ codigoReferido, referidos }: { codigoReferido: string | null; referidos: ResumenLealtad["referidos"] }) {
  const [codigoAUsar, setCodigoAUsar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function onUsarCodigo() {
    if (!codigoAUsar.trim()) return;
    setCargando(true);
    setMensaje(null);
    const res = await registrarReferido(codigoAUsar);
    setCargando(false);
    setMensaje(res.ok ? { tipo: "ok", texto: "¡Listo! Cuando completes tu primera Reserva, tu referente recibe su recompensa." } : { tipo: "error", texto: res.error });
    if (res.ok) setCodigoAUsar("");
  }

  return (
    <section className="mb-6">
      <h2 className="font-display mb-2 text-[12px] font-bold uppercase text-text">Referidos</h2>
      <Card className="mb-2.5">
        <p className="text-[11px] text-text-faint">Tu código para compartir</p>
        <p className="mt-1 text-[20px] font-bold tracking-wide text-accent">{codigoReferido ?? "—"}</p>
      </Card>
      <Card className="mb-2.5">
        <p className="mb-2 text-[11px] text-text-faint">¿Alguien te compartió un código?</p>
        <div className="flex gap-2">
          <Input placeholder="Código de referido" value={codigoAUsar} onChange={(e) => setCodigoAUsar(e.target.value.toUpperCase())} />
          <Button size="sm" loading={cargando} onClick={onUsarCodigo} disabled={!codigoAUsar.trim()}>
            Usar
          </Button>
        </div>
        {mensaje ? <p className={`mt-2 text-[12px] font-semibold ${mensaje.tipo === "ok" ? "text-success" : "text-danger"}`}>{mensaje.texto}</p> : null}
      </Card>
      {referidos.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {referidos.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3 py-2">
              <p className="text-[11.5px] text-text-faint">{new Date(r.createdAt).toLocaleDateString("es-CO")}</p>
              <div className="flex items-center gap-2">
                <Badge tone={r.estado === "COMPLETADO" ? "success" : "neutral"}>{r.estado}</Badge>
                {r.montoRecompensa ? <p className="text-[12px] font-bold text-text">{formatCOP(r.montoRecompensa)}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SeccionFamilia({ familia, onCreada }: { familia: ResumenLealtad["familia"]; onCreada: () => void }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrear() {
    setCreando(true);
    setError(null);
    const res = await crearGrupoFamiliar("Mi familia");
    setCreando(false);
    if (!res.ok) return setError(res.error);
    onCreada();
  }

  if (familia) {
    return (
      <Card>
        <h2 className="font-display mb-1 text-[12px] font-bold uppercase text-text">Mi familia</h2>
        <p className="text-[12.5px] text-text-muted">{familia.nombre} · hasta {familia.limiteMiembros} miembros</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-display mb-1 text-[12px] font-bold uppercase text-text">Paquete familiar</h2>
      <p className="mb-2 text-[12px] text-text-faint">Agrupá a tu familia para compartir beneficios.</p>
      {error ? <p className="mb-2 text-[12px] font-semibold text-danger">{error}</p> : null}
      <Button size="sm" variant="secondary" loading={creando} onClick={onCrear}>
        Crear grupo familiar
      </Button>
    </Card>
  );
}
