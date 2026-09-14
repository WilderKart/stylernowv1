"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { duracion, fechaCorta, fechaHoraLarga, hora, hoyISO, sumarDias } from "@/lib/formato";
import { calcularSenaEstimada, resumenPoliticaCancelacion, type ConfigSena } from "@/lib/pagos/sena";
import { cn, formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { crearReservaAction, obtenerSlots, unirseListaEspera, type Slot } from "./actions";

const DIAS_VISIBLES = 14;

export interface DatosNegocio extends ConfigSena {
  id: string;
  nombre: string;
  slug: string;
  ventana_reembolso_total_horas: number;
  ventana_reembolso_parcial_horas: number;
  reembolso_parcial_pct: number;
}

export interface Servicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  precio_base: number;
}

export interface Sede {
  id: string;
  nombre: string;
  direccion: string;
  zona_horaria: string;
}

export interface Profesional {
  staff_id: string;
  nombre: string;
  foto_url: string | null;
  especialidad: string | null;
  nivel: string | null;
  servicio_ids: string[];
}

const PASOS = ["Servicios", "Profesional", "Horario", "Resumen"];

export function FlujoReserva({
  negocio,
  sedes,
  servicios,
  staff,
}: {
  negocio: DatosNegocio;
  sedes: Sede[];
  servicios: Servicio[];
  staff: Profesional[];
}) {
  const router = useRouter();

  const [paso, setPaso] = useState(1);
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(() => hoyISO(sedes[0]?.zona_horaria));
  const [slot, setSlot] = useState<Slot | null>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [cargandoSlots, iniciarCarga] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoEspera, setAvisoEspera] = useState<string | null>(null);

  const sede = sedes.find((s) => s.id === sedeId) ?? sedes[0];
  const tz = sede?.zona_horaria;

  const seleccionados = servicios.filter((s) => servicioIds.includes(s.id));
  const montoTotal = seleccionados.reduce((a, s) => a + s.precio_base, 0);
  const minutosTotal = seleccionados.reduce((a, s) => a + s.duracion_minutos, 0);
  const sena = calcularSenaEstimada(negocio, montoTotal);

  // Solo el Staff que presta TODOS los Servicios del combo puede tomar la Reserva
  // como una sola cita (03-Business-Rules/02_Booking_Rules.md, combos).
  const staffCompatible = staff.filter((p) =>
    servicioIds.every((id) => p.servicio_ids.includes(id))
  );
  const profesional = staff.find((p) => p.staff_id === staffId) ?? null;

  // La carga corre dentro de una transición: el estado se actualiza al resolver la
  // consulta, nunca de forma síncrona dentro del efecto.
  const cargarSlots = useCallback(() => {
    if (!sede || servicioIds.length === 0) return;
    iniciarCarga(async () => {
      try {
        const nuevos = await obtenerSlots({ sedeId: sede.id, servicioIds, fecha, staffId });
        setSlots(nuevos);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos cargar los horarios.");
        setSlots([]);
      }
    });
  }, [sede, servicioIds, fecha, staffId]);

  useEffect(() => {
    if (paso === 3) cargarSlots();
  }, [paso, cargarSlots]);

  /** Cambiar los Servicios cambia la duración: el horario elegido deja de ser válido. */
  function alternarServicio(id: string) {
    setSlot(null);
    setServicioIds((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id]
    );
  }

  async function confirmar() {
    if (!slot || !sede) return;
    setConfirmando(true);
    setError(null);

    const resultado = await crearReservaAction({
      sedeId: sede.id,
      servicioIds,
      horaInicio: slot.hora_inicio,
      staffId,
      // 05-API/01_Standards.md: un reintento por timeout de red no crea dos Reservas.
      idempotencyKey: crypto.randomUUID(),
    });

    if (resultado.ok) {
      router.push(`/reserva/${resultado.reservaId}/pago`);
      return;
    }

    setConfirmando(false);
    setError(resultado.mensaje);

    if (resultado.codigo === "SLOT_NO_DISPONIBLE") {
      // El grid vuelve actualizado, no se deja al Cliente reintentando a ciegas.
      setSlot(null);
      setPaso(3);
      void cargarSlots();
    }
    if (resultado.codigo === "NO_AUTENTICADO") {
      router.push(`/login?next=/negocio/${negocio.slug}/reservar`);
    }
  }

  async function anotarseEnEspera() {
    if (!sede) return;
    const r = await unirseListaEspera({
      negocioId: negocio.id,
      sedeId: sede.id,
      servicioIds,
      staffId,
      fecha,
    });
    setAvisoEspera(r.mensaje);
  }

  const dias = Array.from({ length: DIAS_VISIBLES }, (_, i) => sumarDias(hoyISO(tz), i));
  const libres = slots.filter((s) => s.disponible);
  const puedeAvanzar =
    (paso === 1 && servicioIds.length > 0) ||
    (paso === 2 && staffCompatible.length > 0) ||
    (paso === 3 && slot !== null);

  return (
    <div className="flex min-h-dvh flex-col pb-32">
      {/* ── Progreso ──────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-2xl px-5 pt-5 sm:px-10">
        <ol className="flex items-center gap-1.5">
          {PASOS.map((nombre, i) => (
            <li key={nombre} className="flex flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-1 rounded-full transition-colors",
                  i + 1 <= paso ? "bg-accent" : "bg-border"
                )}
              />
              <span
                className={cn(
                  "text-[10.5px] font-bold uppercase tracking-wide",
                  i + 1 === paso ? "text-accent" : "text-text-faint"
                )}
              >
                {nombre}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        {/* ── Paso 1 · Servicios ──────────────────────────────────── */}
        {paso === 1 ? (
          <section>
            <h2 className="font-display mb-1 text-[22px] font-bold uppercase text-text">
              ¿Qué te hacés hoy?
            </h2>
            <p className="mb-5 text-[13.5px] text-text-muted">
              Podés combinar varios servicios en una sola cita.
            </p>

            {sedes.length > 1 ? (
              <div className="mb-5">
                <label
                  htmlFor="sede"
                  className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide text-text-muted"
                >
                  Sede
                </label>
                <select
                  id="sede"
                  value={sedeId}
                  onChange={(e) => {
                    setSedeId(e.target.value);
                    setSlot(null);
                  }}
                  className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-[13.5px] text-text outline-none focus:border-accent/60"
                >
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} · {s.direccion}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <ul className="flex flex-col gap-2">
              {servicios.map((s) => {
                const activo = servicioIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => alternarServicio(s.id)}
                      aria-pressed={activo}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                        activo
                          ? "border-accent bg-accent-soft"
                          : "border-border-subtle bg-surface hover:border-accent/40"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-text">
                          {s.nombre}
                        </span>
                        <span className="block text-[12px] text-text-faint">
                          {duracion(s.duracion_minutos)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[14px] font-bold text-accent">
                        {formatCOP(s.precio_base)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* ── Paso 2 · Profesional ────────────────────────────────── */}
        {paso === 2 ? (
          <section>
            <h2 className="font-display mb-1 text-[22px] font-bold uppercase text-text">
              ¿Con quién?
            </h2>
            <p className="mb-5 text-[13.5px] text-text-muted">
              Elegí a tu profesional o dejanos asignarte el primero disponible.
            </p>

            {staffCompatible.length === 0 ? (
              <div className="rounded-2xl border border-danger/40 bg-danger-soft p-4">
                <p className="text-[13.5px] font-semibold text-text">
                  Ningún profesional ofrece esta combinación
                </p>
                <p className="mt-1 text-[12.5px] text-text-muted">
                  Reservá los servicios por separado, en dos citas.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStaffId(null);
                    setSlot(null);
                  }}
                  aria-pressed={staffId === null}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                    staffId === null
                      ? "border-accent bg-accent-soft"
                      : "border-border-subtle bg-surface hover:border-accent/40"
                  )}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-bg">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M13 2L4.5 13.5H11l-1 8.5 9-12h-6.5z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold text-text">
                      Cualquiera disponible
                    </span>
                    <span className="block text-[12px] text-text-muted">
                      La opción más rápida: más horarios para elegir.
                    </span>
                  </span>
                </button>

                {staffCompatible.map((p) => {
                  const activo = staffId === p.staff_id;
                  return (
                    <button
                      key={p.staff_id}
                      type="button"
                      onClick={() => {
                        setStaffId(p.staff_id);
                        setSlot(null);
                      }}
                      aria-pressed={activo}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                        activo
                          ? "border-accent bg-accent-soft"
                          : "border-border-subtle bg-surface hover:border-accent/40"
                      )}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-[15px] font-bold text-text-faint">
                        {p.nombre.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-text">
                          {p.nombre}
                        </span>
                        {p.especialidad ? (
                          <span className="block truncate text-[12px] text-text-faint">
                            {p.especialidad}
                          </span>
                        ) : null}
                      </span>
                      {p.nivel ? <Badge tone="accent">{p.nivel}</Badge> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* ── Paso 3 · Horario ────────────────────────────────────── */}
        {paso === 3 ? (
          <section>
            <h2 className="font-display mb-1 text-[22px] font-bold uppercase text-text">
              ¿Cuándo?
            </h2>
            <p className="mb-4 text-[13.5px] text-text-muted">
              {duracion(minutosTotal)} · {profesional ? profesional.nombre : "Cualquiera disponible"}
            </p>

            <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
              {dias.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setFecha(d);
                    setSlot(null);
                  }}
                  aria-pressed={fecha === d}
                  className={cn(
                    "shrink-0 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-semibold capitalize transition-colors",
                    fecha === d
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-text-muted hover:border-accent/40"
                  )}
                >
                  {fechaCorta(d, tz)}
                </button>
              ))}
            </div>

            {cargandoSlots ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-11 animate-pulse rounded-xl bg-surface" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
                <p className="text-[13.5px] font-semibold text-text">
                  No hay horarios ese día
                </p>
                <p className="mx-auto mt-1 max-w-[280px] text-[12.5px] text-text-faint">
                  Probá con otra fecha o avisanos y te escribimos apenas se libere un cupo.
                </p>
                {avisoEspera ? (
                  <p className="mt-3 text-[12.5px] font-semibold text-success">{avisoEspera}</p>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                    onClick={anotarseEnEspera}
                  >
                    AVISARME CUANDO HAYA CUPO
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {/* Los ocupados se muestran tachados, no ausentes (02-UX/05_Booking.md). */}
                  {slots.map((s) => {
                    const elegido = slot?.hora_inicio === s.hora_inicio;
                    return (
                      <button
                        key={s.hora_inicio}
                        type="button"
                        disabled={!s.disponible}
                        onClick={() => setSlot(s)}
                        className={cn(
                          "h-11 rounded-xl border text-[13px] font-semibold transition-colors",
                          !s.disponible &&
                            "cursor-not-allowed border-border-subtle text-text-faint line-through opacity-60",
                          s.disponible &&
                            !elegido &&
                            "border-border text-text hover:border-accent/50",
                          elegido && "border-accent bg-accent text-bg"
                        )}
                      >
                        {hora(s.hora_inicio, tz)}
                      </button>
                    );
                  })}
                </div>

                {libres.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-center">
                    <p className="text-[13px] text-text-muted">
                      Todos los turnos de ese día están tomados.
                    </p>
                    {avisoEspera ? (
                      <p className="mt-2 text-[12.5px] font-semibold text-success">{avisoEspera}</p>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        onClick={anotarseEnEspera}
                      >
                        AVISARME CUANDO HAYA CUPO
                      </Button>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {/* ── Paso 4 · Resumen ────────────────────────────────────── */}
        {paso === 4 && slot ? (
          <section>
            <h2 className="font-display mb-5 text-[22px] font-bold uppercase text-text">
              Confirmá tu turno
            </h2>

            <dl className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
              <div className="flex justify-between gap-3">
                <dt className="text-[12.5px] text-text-muted">Servicios</dt>
                <dd className="text-right text-[13px] font-semibold text-text">
                  {seleccionados.map((s) => s.nombre).join(" + ")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[12.5px] text-text-muted">Profesional</dt>
                <dd className="text-[13px] font-semibold text-text">
                  {profesional ? profesional.nombre : "Se asigna al confirmar"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[12.5px] text-text-muted">Sede</dt>
                <dd className="text-right text-[13px] font-semibold text-text">
                  {sede?.nombre}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[12.5px] text-text-muted">Fecha y hora</dt>
                <dd className="text-right text-[13px] font-semibold capitalize text-text">
                  {fechaHoraLarga(slot.hora_inicio, tz)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[12.5px] text-text-muted">Duración</dt>
                <dd className="text-[13px] font-semibold text-text">{duracion(minutosTotal)}</dd>
              </div>

              <div className="mt-1 border-t border-border-subtle pt-3">
                <div className="flex justify-between gap-3">
                  <dt className="text-[12.5px] text-text-muted">Total del servicio</dt>
                  <dd className="text-[13px] font-semibold text-text">{formatCOP(montoTotal)}</dd>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] font-bold text-text">Seña a pagar ahora</dt>
                  <dd className="font-display text-[20px] font-bold text-accent">
                    {formatCOP(sena)}
                  </dd>
                </div>
                {sena < montoTotal ? (
                  <p className="mt-1 text-[11.5px] text-text-faint">
                    El saldo de {formatCOP(montoTotal - sena)} lo pagás en el local.
                  </p>
                ) : null}
              </div>
            </dl>

            {/* Nunca se paga sin ver antes la política de cancelación. */}
            <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-4">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
                Política de cancelación
              </p>
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                {resumenPoliticaCancelacion(negocio).map((linea) => (
                  <li key={linea} className="text-[12.5px] leading-relaxed text-text-muted">
                    {linea}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-[12.5px] font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </main>

      {/* ── Navegación ────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-10">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          {paso > 1 ? (
            <Button
              variant="secondary"
              size="lg"
              className="shrink-0 px-5"
              onClick={() => {
                setError(null);
                setPaso((p) => p - 1);
              }}
            >
              ATRÁS
            </Button>
          ) : null}

          {paso < 4 ? (
            <Button
              size="lg"
              className="flex-1"
              disabled={!puedeAvanzar}
              onClick={() => {
                setError(null);
                setPaso((p) => p + 1);
              }}
            >
              {paso === 1 && montoTotal > 0
                ? `CONTINUAR · ${formatCOP(montoTotal)}`
                : "CONTINUAR"}
            </Button>
          ) : (
            <Button size="lg" className="flex-1" loading={confirmando} onClick={confirmar}>
              IR A PAGAR {formatCOP(sena)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
