"use client";

import {
  agregarEtiqueta,
  crearNota,
  eliminarFoto,
  eliminarNota,
  listarReservasCompletadas,
  quitarEtiqueta,
  subirFoto,
  type BeneficiosLealtadCliente,
  type FotoCliente,
  type NotaCliente,
  type ReservaHistorial,
  type ResumenCliente,
} from "@/app/panel/crm/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { useRef, useState } from "react";

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  PENDIENTE_PAGO: "neutral",
  CONFIRMADA: "accent",
  EN_CURSO: "success",
  COMPLETADA: "success",
  CANCELADA: "danger",
  NO_SHOW: "danger",
};

export function DetalleCliente({
  negocioId,
  resumen,
  historialInicial,
  notasIniciales,
  fotosIniciales,
  beneficiosLealtad,
}: {
  negocioId: string;
  resumen: ResumenCliente;
  historialInicial: ReservaHistorial[];
  notasIniciales: NotaCliente[];
  fotosIniciales: FotoCliente[];
  beneficiosLealtad: BeneficiosLealtadCliente | null;
}) {
  const [etiquetas, setEtiquetas] = useState<string[]>(
    resumen.esVip ? ["VIP"] : []
  );
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [notas, setNotas] = useState(notasIniciales);
  const [nuevaNota, setNuevaNota] = useState("");
  const [fotos, setFotos] = useState(fotosIniciales);
  const [error, setError] = useState<string | null>(null);
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [guardandoEtiqueta, setGuardandoEtiqueta] = useState(false);

  async function onAgregarEtiqueta() {
    if (!nuevaEtiqueta.trim()) return;
    setGuardandoEtiqueta(true);
    setError(null);
    const res = await agregarEtiqueta(negocioId, resumen.clienteId, nuevaEtiqueta);
    setGuardandoEtiqueta(false);
    if (!res.ok) return setError(res.error);
    setEtiquetas((prev) => [...prev, nuevaEtiqueta.trim()]);
    setNuevaEtiqueta("");
  }

  async function onQuitarEtiqueta(e: string) {
    const anterior = etiquetas;
    setEtiquetas((prev) => prev.filter((x) => x !== e));
    const res = await quitarEtiqueta(negocioId, resumen.clienteId, e);
    if (!res.ok) {
      setEtiquetas(anterior);
      setError(res.error);
    }
  }

  async function onCrearNota() {
    if (!nuevaNota.trim()) return;
    setGuardandoNota(true);
    setError(null);
    const res = await crearNota(negocioId, resumen.clienteId, nuevaNota);
    setGuardandoNota(false);
    if (!res.ok) return setError(res.error);
    setNotas((prev) => [{ id: crypto.randomUUID(), texto: nuevaNota.trim(), createdAt: new Date().toISOString(), autorNombre: "Vos" }, ...prev]);
    setNuevaNota("");
  }

  async function onEliminarNota(id: string) {
    const anterior = notas;
    setNotas((prev) => prev.filter((n) => n.id !== id));
    const res = await eliminarNota(id, resumen.clienteId);
    if (!res.ok) {
      setNotas(anterior);
      setError(res.error);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
      {error ? (
        <p role="alert" className="mb-4 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {/* ── Resumen ───────────────────────────────────────────────────── */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[16px] font-bold text-text">{resumen.nombre}</p>
          {resumen.esVip ? <Badge tone="accent">VIP</Badge> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <p className="text-text-faint">LTV</p>
            <p className="font-bold text-text">{formatCOP(resumen.ltv)}</p>
          </div>
          <div>
            <p className="text-text-faint">Visitas</p>
            <p className="font-bold text-text">{resumen.visitas}</p>
          </div>
          <div>
            <p className="text-text-faint">Última visita</p>
            <p className="font-bold text-text">
              {resumen.ultimaVisita ? new Date(resumen.ultimaVisita).toLocaleDateString("es-CO") : "—"}
            </p>
          </div>
          <div>
            <p className="text-text-faint">Puntos de fidelización</p>
            <p className="font-bold text-text">{resumen.puntosActuales}</p>
          </div>
          <div>
            <p className="text-text-faint">Servicio favorito</p>
            <p className="font-bold text-text">{resumen.servicioFavorito ?? "—"}</p>
          </div>
          <div>
            <p className="text-text-faint">Staff preferido</p>
            <p className="font-bold text-text">{resumen.staffPreferido ?? "—"}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-text-faint">
          Riesgo de abandono: no disponible todavía — depende de la Inteligencia de Negocio
          de Fase 6 (no se muestra un número inventado).
        </p>
        {resumen.telefono ? <p className="mt-2 text-[12px] text-text-muted">{resumen.telefono}</p> : null}
      </Card>

      {/* ── Lealtad (ADR-011, transversal) ───────────────────────────── */}
      {beneficiosLealtad ? (
        <section className="mb-6">
          <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">Lealtad</h2>
          <Card className="flex flex-col gap-2.5">
            {beneficiosLealtad.nivelVip ? (
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-text-faint">Club VIP</p>
                <Badge tone="accent">{beneficiosLealtad.nivelVip}</Badge>
              </div>
            ) : null}
            {beneficiosLealtad.membresiaActiva ? (
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-text-faint">Membresía</p>
                <p className="text-[12.5px] font-semibold text-text">
                  {beneficiosLealtad.membresiaActiva.planNombre}
                  {beneficiosLealtad.membresiaActiva.limiteUsosMes ? ` · ${beneficiosLealtad.membresiaActiva.usosMesActual}/${beneficiosLealtad.membresiaActiva.limiteUsosMes} usos este mes` : ""}
                </p>
              </div>
            ) : null}
            {beneficiosLealtad.cashbackPendiente > 0 ? (
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-text-faint">Cashback disponible</p>
                <p className="text-[12.5px] font-bold text-success">{formatCOP(beneficiosLealtad.cashbackPendiente)}</p>
              </div>
            ) : null}
            {beneficiosLealtad.sellosProgreso.map((s) => (
              <div key={s.campanaNombre} className="flex items-center justify-between">
                <p className="text-[12px] text-text-faint">Sellos · {s.campanaNombre}</p>
                <p className="text-[12.5px] font-semibold text-text">{s.sellosActuales}/{s.sellosRequeridos}</p>
              </div>
            ))}
            {!beneficiosLealtad.nivelVip && !beneficiosLealtad.membresiaActiva && beneficiosLealtad.cashbackPendiente === 0 && beneficiosLealtad.sellosProgreso.length === 0 ? (
              <p className="text-[12px] text-text-faint">Sin beneficios de Lealtad activos en tu negocio todavía.</p>
            ) : null}
          </Card>
        </section>
      ) : null}

      {/* ── Etiquetas ─────────────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">Etiquetas</h2>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {resumen.esVip ? <Badge tone="accent">VIP (automática por LTV)</Badge> : null}
          {etiquetas.filter((e) => e !== "VIP").map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onQuitarEtiqueta(e)}
              className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-muted hover:bg-danger-soft hover:text-danger"
              title="Tocá para quitar"
            >
              {e} ×
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Nueva etiqueta..." value={nuevaEtiqueta} onChange={(e) => setNuevaEtiqueta(e.target.value)} />
          <Button size="sm" variant="secondary" loading={guardandoEtiqueta} onClick={onAgregarEtiqueta}>
            Agregar
          </Button>
        </div>
      </section>

      {/* ── Fotos ─────────────────────────────────────────────────────── */}
      <SeccionFotos negocioId={negocioId} clienteId={resumen.clienteId} fotos={fotos} onCambio={setFotos} onError={setError} />

      {/* ── Notas ─────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">Notas</h2>
        <div className="mb-3 flex gap-2">
          <Input placeholder="Escribí una nota privada..." value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} />
          <Button size="sm" loading={guardandoNota} onClick={onCrearNota}>
            Agregar
          </Button>
        </div>
        {notas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12px] text-text-faint">
            Sin notas todavía.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notas.map((n) => (
              <li key={n.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
                <p className="text-[12.5px] text-text">{n.texto}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-[10.5px] text-text-faint">
                    {n.autorNombre ?? "Alguien del equipo"} ·{" "}
                    {new Date(n.createdAt).toLocaleDateString("es-CO")}
                  </p>
                  <button type="button" onClick={() => onEliminarNota(n.id)} className="text-[10.5px] font-semibold text-danger">
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Historial ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">Historial</h2>
        {historialInicial.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12px] text-text-faint">
            Sin reservas todavía.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historialInicial.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-text">
                      {new Date(r.horaInicio).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="truncate text-[11.5px] text-text-faint">
                      {r.servicios || "Sin servicio"} {r.staffNombre ? `· ${r.staffNombre}` : ""}
                    </p>
                    {r.resena ? (
                      <p className="mt-1 text-[11px] text-accent">
                        {"★".repeat(r.resena.calificacion)}
                        {r.resena.comentario ? ` — "${r.resena.comentario}"` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={ESTADO_TONO[r.estado] ?? "neutral"}>{r.estado}</Badge>
                    <p className="mt-1 text-[12px] font-bold text-text">{formatCOP(r.montoTotal)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SeccionFotos({
  negocioId,
  clienteId,
  fotos,
  onCambio,
  onError,
}: {
  negocioId: string;
  clienteId: string;
  fotos: FotoCliente[];
  onCambio: (f: FotoCliente[]) => void;
  onError: (e: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reservas, setReservas] = useState<{ id: string; horaInicio: string }[] | null>(null);
  const [reservaId, setReservaId] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  async function onAbrirSelector() {
    if (!reservas) {
      const res = await listarReservasCompletadas(negocioId, clienteId);
      if (res.ok) setReservas(res.data);
    }
    inputRef.current?.click();
  }

  async function onArchivoElegido(archivo: File) {
    if (!reservaId) {
      onError("Elegí a qué reserva pertenece la foto antes de subirla.");
      return;
    }
    if (!consentimiento) {
      onError("Marcá el consentimiento explícito del Cliente antes de subir la foto.");
      return;
    }
    setSubiendo(true);
    const dataUrl: string = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = reject;
      lector.readAsDataURL(archivo);
    });
    const res = await subirFoto({ negocioId, clienteId, reservaId, dataUrl, consentimiento: true });
    setSubiendo(false);
    if (!res.ok) return onError(res.error);
    onCambio([{ id: crypto.randomUUID(), url: dataUrl, createdAt: new Date().toISOString() }, ...fotos]);
  }

  async function onEliminar(id: string) {
    const anterior = fotos;
    onCambio(fotos.filter((f) => f.id !== id));
    const res = await eliminarFoto(id, clienteId);
    if (!res.ok) onCambio(anterior);
  }

  return (
    <section className="mb-6">
      <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">Fotos de resultados</h2>

      {reservas ? (
        <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-border-subtle bg-surface p-3.5">
          <select
            value={reservaId}
            onChange={(e) => setReservaId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-bg px-2 text-[12px] text-text"
          >
            <option value="">¿De qué reserva es esta foto?</option>
            {reservas.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.horaInicio).toLocaleDateString("es-CO")}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[11.5px] text-text-muted">
            <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
            El Cliente dio su consentimiento explícito para guardar esta foto.
          </label>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) onArchivoElegido(archivo);
          e.target.value = "";
        }}
      />
      <Button size="sm" variant="secondary" loading={subiendo} onClick={onAbrirSelector}>
        + Subir foto
      </Button>

      {fotos.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onEliminar(f.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
