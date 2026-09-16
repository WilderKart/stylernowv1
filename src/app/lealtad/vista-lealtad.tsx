"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { crearGrupoFamiliar, registrarReferido, type ResumenLealtad } from "./actions";

const MEMBRESIA_ESTADO_TONO: Record<string, "success" | "accent" | "neutral"> = {
  ACTIVA: "success",
  PROXIMA_A_VENCER: "accent",
  SUSPENDIDA: "neutral",
};

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
  const [resumen] = useState(resumenInicial);
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

      {resumen.membresias.length > 0 ? (
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-[12px] font-bold uppercase text-text">Mis Membresías</h2>
            <Link href="/membresias" className="text-[11px] font-bold uppercase text-accent">Ver todas →</Link>
          </div>
          <ul className="flex flex-col gap-1.5">
            {resumen.membresias.slice(0, 3).map((m) => (
              <li key={m.id}>
                <Link href={`/membresias/${m.id}`} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3 py-2">
                  <div>
                    <p className="text-[12px] font-semibold text-text">{m.planNombre}</p>
                    <p className="text-[10.5px] text-text-faint">{m.negocioNombre}</p>
                  </div>
                  <Badge tone={MEMBRESIA_ESTADO_TONO[m.estado] ?? "neutral"}>{m.estado === "SUSPENDIDA" ? "Congelada" : m.estado === "PROXIMA_A_VENCER" ? "Por vencer" : "Activa"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SeccionGiftCard />

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

function SeccionGiftCard() {
  // Por seguridad (ADR-014, Fase B: "canje únicamente desde POS") el canje
  // de una Gift Card ya no es autoservicio remoto — se acredita al
  // StylerWallet solo cuando el Staff la registra en el local. Acá el
  // Cliente solo compra o consulta su saldo, nunca canjea a distancia.
  return (
    <Card className="mb-6">
      <h2 className="font-display mb-2 text-[12px] font-bold uppercase text-text">Gift Cards</h2>
      <p className="mb-3 text-[12px] text-text-muted">Comprá una para vos o para regalar, y consultá el saldo de las que ya tenés.</p>
      <Link href="/gift-cards" className="text-[12px] font-bold uppercase text-accent">Ver Gift Cards →</Link>
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
