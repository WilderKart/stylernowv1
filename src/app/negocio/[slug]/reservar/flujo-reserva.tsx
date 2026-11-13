"use client";

import { Button } from "@/components/ui/button";
import { Chip, EmptyState, Label, Meta, Num, Photo, Status, Tier } from "@/components/brutal";
import { SlotsPorFranja } from "@/components/negocio/horas-agrupadas";
import { FOTOS_RESPALDO, nivelATier } from "@/components/negocio/nivel";
import { duracion, fechaCorta, fechaHoraLarga, fechaISO, hora, hoyISO, sumarDias } from "@/lib/formato";
import { AvisoDistancia } from "./aviso-distancia";
import { useT } from "@/lib/i18n/proveedor";
import { calcularSenaEstimada, resumenPoliticaCancelacion, type ConfigSena } from "@/lib/pagos/sena";
import { cn, formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { crearReservaAction, obtenerSlots, unirseListaEspera, type Slot } from "./actions";

const DIAS_VISIBLES = 14;
const DIAS_POR_VENTANA = 6;

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
  ciudad?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

export interface Combo {
  id: string;
  nombre: string;
  servicio_ids: string[];
}

export interface Profesional {
  staff_id: string;
  nombre: string;
  foto_url: string | null;
  especialidad: string | null;
  nivel: string | null;
  servicio_ids: string[];
}

const PASOS = ["res.paso_servicio", "res.paso_profesional", "res.paso_hora", "res.paso_resumen"] as const;

export function FlujoReserva({
  negocio,
  sedes,
  servicios,
  staff,
  combos,
}: {
  negocio: DatosNegocio;
  sedes: Sede[];
  servicios: Servicio[];
  staff: Profesional[];
  combos: Combo[];
}) {
  const router = useRouter();
  const t = useT();
  const staffInicial = useSearchParams().get("staff");

  const [paso, setPaso] = useState(1);
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffInicialAplicado, setStaffInicialAplicado] = useState(false);
  const [fecha, setFecha] = useState(() => hoyISO(sedes[0]?.zona_horaria));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [inicioDias, setInicioDias] = useState(0);
  // Mientras el cliente no toque el selector de día, se salta solo al primer día con horas libres
  // (si hoy ya cerró, abrir en un día todo tachado parece que el negocio no tiene disponibilidad).
  const diaElegidoManualmente = useRef(false);

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
  // consulta, nunca de forma síncrona dentro del efecto. Volver al paso 3 (p. ej. tras
  // SLOT_NO_DISPONIBLE) re-dispara el efecto y refresca el grid.
  useEffect(() => {
    if (paso !== 3 || !sede || servicioIds.length === 0) return;
    iniciarCarga(async () => {
      try {
        const nuevos = await obtenerSlots({ sedeId: sede.id, servicioIds, fecha, staffId });
        setSlots(nuevos);
        setError(null);
        if (!diaElegidoManualmente.current && !nuevos.some((x) => x.disponible)) {
          const rango = Array.from({ length: DIAS_VISIBLES }, (_, i) => sumarDias(hoyISO(sede.zona_horaria), i));
          const idx = rango.indexOf(fecha);
          if (idx >= 0 && idx < rango.length - 1) {
            setFecha(rango[idx + 1]);
            setInicioDias(Math.max(0, Math.min(idx + 1 - 1, DIAS_VISIBLES - DIAS_POR_VENTANA)));
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("res.err_horarios"));
        setSlots([]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t es estable por idioma
  }, [paso, sede, servicioIds, fecha, staffId]);

  /** Cambiar los Servicios cambia la duración: el horario elegido deja de ser válido. */
  function alternarServicio(id: string) {
    const nuevos = servicioIds.includes(id) ? servicioIds.filter((x) => x !== id) : [...servicioIds, id];
    cambiarServicios(nuevos);
  }

  /** Un profesional preseleccionado (desde su perfil) que no presta todos los
   * servicios elegidos vuelve a "cualquiera disponible". */
  function cambiarServicios(nuevos: string[]) {
    setSlot(null);
    setServicioIds(nuevos);
    const actual = staff.find((p) => p.staff_id === staffId);
    if (actual && !nuevos.every((sid) => actual.servicio_ids.includes(sid))) setStaffId(null);
  }

  /** Un combo (Módulo 2.5) es solo un atajo de selección — reemplaza la
   * elección actual por el conjunto de Servicios del combo. El motor de
   * disponibilidad sigue sumando la duración/precio de cada Servicio
   * individual (docs/TECH_DEBT_REGISTER.md: el override del combo todavía
   * no está conectado ahí), así que esto no cambia ningún cálculo. */
  function elegirCombo(combo: Combo) {
    cambiarServicios(combo.servicio_ids);
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
      // Sin anticipo la base confirma la reserva al crearla (migración 119): no hay pantalla de pago.
      router.push(sena > 0 ? `/reserva/${resultado.reservaId}/pago` : `/reserva/${resultado.reservaId}`);
      return;
    }

    setConfirmando(false);
    setError(resultado.mensaje);

    if (resultado.codigo === "SLOT_NO_DISPONIBLE") {
      // El grid vuelve actualizado, no se deja al Cliente reintentando a ciegas.
      setSlot(null);
      setPaso(3);
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
  const diasVentana = dias.slice(inicioDias, inicioDias + DIAS_POR_VENTANA);
  const libres = slots.filter((s) => s.disponible);
  const puedeAvanzar =
    (paso === 1 && servicioIds.length > 0) ||
    (paso === 2 && staffCompatible.length > 0) ||
    (paso === 3 && slot !== null);

  const iconoFlecha = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
  const iconoVolver = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );

  function volver() {
    setError(null);
    setPaso((p) => p - 1);
  }

  const bloqueAnticipo = (
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Meta>
        {paso === 1
          ? `${seleccionados.length === 1 ? t("res.n_servicio", { n: seleccionados.length }) : t("res.n_servicios", { n: seleccionados.length })} · ${duracion(minutosTotal)}`
          : paso === 3 && slot
            ? `${fechaCorta(fecha, tz)} · ${hora(slot.hora_inicio, tz)}`
            : `${duracion(minutosTotal)}`}
      </Meta>
      <span className="sn-fig text-[22px]">{formatCOP(montoTotal)}</span>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* ── Barra superior + progreso ───────────────────────────────── */}
      <div className="p-top">
        {paso > 1 ? (
          <button type="button" onClick={volver} aria-label={t("res.volver_paso")} className="sn-iconbtn">
            {iconoVolver}
          </button>
        ) : (
          <Link href={`/negocio/${negocio.slug}`} aria-label={t("res.volver_negocio")} className="sn-iconbtn">
            {iconoVolver}
          </Link>
        )}
        <span className="sn-num min-w-0 break-words">{t("res.reserva_negocio", { nombre: negocio.nombre })}</span>
        <span className="p-top__r" />
      </div>
      <ol className="p-steps m-0 list-none p-0" aria-label={t("res.pasos")}>
        {PASOS.map((nombre, i) => (
          <li
            key={nombre}
            aria-current={i + 1 === paso ? "step" : undefined}
            className={cn(
              "min-w-0 truncate border-r border-grid px-0.5 py-2 text-center font-mono text-[11px] leading-[14px] font-bold tracking-[0.66px] uppercase last:border-r-0",
              i + 1 === paso && "bg-signal text-ink",
              i + 1 < paso && "bg-text text-bg"
            )}
          >
            {String(i + 1).padStart(2, "0")} {t(nombre)}
          </li>
        ))}
      </ol>

      {/* Aviso de distancia (no bloquea): evita reservar por error en otra ciudad. */}
      <AvisoDistancia negocio={negocio.nombre} sede={sede} />

      <main className="flex-1 pb-4">
        {/* ── Paso 1 · Servicios ──────────────────────────────────── */}
        {paso === 1 ? (
          <section>
            <h1 className="poster-2 px-4 pt-3 pb-4 break-words">
              {t("res.t1_1")}
              <br />
              <span className="sn-hot">{t("res.t1_2")}</span>
            </h1>

            {sedes.length > 1 ? (
              <div className="sn-field px-4 pb-4">
                <label htmlFor="sede">{t("res.sede")}</label>
                <select
                  id="sede"
                  value={sedeId}
                  onChange={(e) => {
                    setSedeId(e.target.value);
                    setSlot(null);
                  }}
                  className="min-h-12 w-full min-w-0 border-2 border-border bg-bg px-3 text-[15px] text-text outline-none focus:shadow-hard"
                >
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} · {s.direccion}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {combos.length > 0 ? (
              <div className="pb-1">
                <div className="p-sec !pt-0">
                  <Label>{t("res.combos")}</Label>
                </div>
                <div className="p-chips">
                  {combos.map((c) => (
                    <Chip
                      key={c.id}
                      selected={
                        servicioIds.length === c.servicio_ids.length &&
                        c.servicio_ids.every((id) => servicioIds.includes(id))
                      }
                      onClick={() => elegirCombo(c)}
                      className="!min-h-12 !whitespace-normal"
                    >
                      {c.nombre}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            <ul className="m-0 list-none border-t-2 border-line p-0">
              {servicios.map((s) => {
                const activo = servicioIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => alternarServicio(s.id)}
                      aria-pressed={activo}
                      className={cn(
                        "flex min-h-[64px] w-full items-center gap-3 border-0 border-b border-grid-soft px-4 py-3.5 text-left text-text",
                        activo && "bg-signal text-ink"
                      )}
                    >
                      <span className="grid size-[26px] shrink-0 place-items-center border-2 border-current" aria-hidden="true">
                        {activo ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
                            <path d="M4 12l5 5L20 6" />
                          </svg>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="body block break-words">{s.nombre}</b>
                        <span className="sn-meta !text-current">{duracion(s.duracion_minutos)}</span>
                      </span>
                      <span className="sn-price shrink-0">{formatCOP(s.precio_base)}</span>
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
            <h1 className="poster-2 px-4 pt-3 pb-4 break-words">
              {t("res.t2_1")}
              <br />
              <span className="sn-hot">{t("res.t2_2")}</span>
            </h1>

            {staffCompatible.length === 0 ? (
              <EmptyState
                big={t("res.sin_match")}
                title={t("res.sin_match_titulo")}
                hint={t("res.sin_match_hint")}
              />
            ) : (
              <div className="p-stack px-4 pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setStaffId(null);
                    setSlot(null);
                  }}
                  aria-pressed={staffId === null}
                  className={cn(
                    "flex min-h-[72px] w-full items-center justify-between gap-3 border-2 border-line p-4 text-left text-text",
                    staffId === null && "bg-signal text-ink shadow-hard"
                  )}
                >
                  <span className="min-w-0">
                    <b className="section block text-base break-words">{t("res.cualquiera")}</b>
                    <span className="sn-meta !text-current">{t("res.cualquiera_meta")}</span>
                  </span>
                  {iconoFlecha}
                </button>

                {staffCompatible.map((p, i) => {
                  const activo = staffId === p.staff_id;
                  return (
                    <div key={p.staff_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffId(p.staff_id);
                        setSlot(null);
                      }}
                      aria-pressed={activo}
                      className={cn("block w-full text-left", activo && "shadow-hard")}
                    >
                      <div className="sn-pro">
                        <Photo src={p.foto_url ?? FOTOS_RESPALDO[i % FOTOS_RESPALDO.length]} />
                        <div className="sn-pro__info">
                          <span className="sn-meta">{p.especialidad ?? t("res.profesional")}</span>
                          <h3 className="sn-pro__name poster-5 break-words">{p.nombre}</h3>
                          <div className="sn-pro__foot">
                            {nivelATier(p.nivel) ? <Tier level={nivelATier(p.nivel)!} /> : <span />}
                            <span className="sn-price">{activo ? t("res.elegido") : t("res.elegir")}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <Link
                      href={`/negocio/${negocio.slug}/profesional/${p.staff_id}`}
                      className="sn-label inline-flex min-h-12 items-center underline"
                    >
                      {t("res.ver_perfil", { nombre: p.nombre })}
                    </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* ── Paso 3 · Horario ────────────────────────────────────── */}
        {paso === 3 ? (
          <section>
            <h1 className="poster-2 px-4 pt-3 pb-4 break-words">
              {t("res.t3_1")}
              <br />
              <span className="sn-hot">{t("res.t3_2")}</span>
            </h1>
            <div className="px-4 pb-2">
              <Label>
                {duracion(minutosTotal)} · {profesional ? profesional.nombre : t("res.cualquiera")}
              </Label>
            </div>

            <div className="flex items-center justify-between gap-2 px-4 pb-2">
              <Chip
                disabled={inicioDias === 0}
                onClick={() => setInicioDias((i) => Math.max(0, i - DIAS_POR_VENTANA))}
                aria-label={t("res.dias_anteriores")}
              >
                {t("res.antes")}
              </Chip>
              <Chip
                disabled={inicioDias + DIAS_POR_VENTANA >= DIAS_VISIBLES}
                onClick={() => setInicioDias((i) => Math.min(DIAS_VISIBLES - DIAS_POR_VENTANA, i + DIAS_POR_VENTANA))}
                aria-label={t("res.dias_siguientes")}
              >
                {t("res.despues")}
              </Chip>
            </div>
            <div className="px-4 pb-4">
              <div className="sn-days">
                {diasVentana.map((d) => {
                  const [dSem, ...resto] = fechaCorta(d, tz).split(" ");
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        diaElegidoManualmente.current = true;
                        setFecha(d);
                        setSlot(null);
                      }}
                      aria-pressed={fecha === d}
                      aria-label={fechaCorta(d, tz)}
                      className={cn("sn-day", fecha === d && "is-selected")}
                    >
                      {dSem.replace(".", "")}
                      <b>{resto[0]}</b>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sn-row px-4 pb-2">
              <Label>{t("res.horarios")}</Label>
              <Meta>{t("res.tachado")}</Meta>
            </div>

            <div className="px-4 pb-4">
              {cargandoSlots ? (
                <div className="sn-slots" aria-busy="true" aria-label={t("res.cargando_horarios")}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="sn-slot animate-pulse bg-surface" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="border-2 border-dashed border-line p-6 text-center">
                  <h3 className="section">{t("res.no_horarios")}</h3>
                  <p className="sn-meta mx-auto mt-2 max-w-[320px]">
                    {t("res.no_horarios_hint")}
                  </p>
                  {avisoEspera ? (
                    <div className="mt-3">
                      <Status tone="ok">{avisoEspera}</Status>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" className="mt-4" onClick={anotarseEnEspera}>
                      {t("res.avisarme")}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Los ocupados se muestran tachados, no ausentes (02-UX/05_Booking.md). */}
                  <SlotsPorFranja slots={slots} tz={tz} elegido={slot?.hora_inicio ?? null} onElegir={setSlot} />

                  {libres.length === 0 ? (
                    <div className="mt-4 border-2 border-line p-4 text-center">
                      <p className="body-sm m-0">{t("res.todos_tomados")}</p>
                      {avisoEspera ? (
                        <div className="mt-3">
                          <Status tone="ok">{avisoEspera}</Status>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" className="mt-3" onClick={anotarseEnEspera}>
                          {t("res.avisarme")}
                        </Button>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>
        ) : null}

        {/* ── Paso 4 · Resumen ────────────────────────────────────── */}
        {paso === 4 && slot ? (
          <section>
            <h1 className="poster-2 px-4 pt-3 pb-4 break-words">
              {t("res.t4_1")}
              <br />
              <span className="sn-hot">{t("res.t4_2")}</span>
            </h1>

            <div className="px-4 pb-4">
              <div className="sn-ticket">
                <div className="sn-ticket__top">
                  <div className="sn-ticket__date">
                    <span className="sn-meta">{fechaCorta(fechaISO(slot.hora_inicio, tz), tz).split(" ")[2]?.replace(".", "")}</span>
                    <b>{Number(fechaISO(slot.hora_inicio, tz).slice(8, 10))}</b>
                  </div>
                  <div className="sn-ticket__main min-w-0">
                    <Status tone="warn">{t("estado.pendiente_pago")}</Status>
                    <h3 className="poster-5 m-0 break-words">{seleccionados.map((s) => s.nombre).join(" + ")}</h3>
                    <span className="sn-meta break-words">
                      {profesional ? profesional.nombre : t("res.por_asignar")} · {hora(slot.hora_inicio, tz)} · {sede?.nombre}
                    </span>
                  </div>
                </div>
                <div className="sn-ticket__perf" />
                <div className="sn-ticket__foot">
                  <span className="sn-label">{t("res.total")}</span>
                  <span className="sn-fig text-[22px]">{formatCOP(montoTotal)}</span>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-line">
              {[
                [t("res.k_servicios"), seleccionados.map((s) => s.nombre).join(" + ")],
                [t("res.k_profesional"), profesional ? profesional.nombre : t("res.se_asigna")],
                [t("res.k_sede"), sede?.nombre ?? ""],
                [t("res.k_fecha"), fechaHoraLarga(slot.hora_inicio, tz)],
                [t("res.k_duracion"), duracion(minutosTotal)],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-grid-soft px-4 py-3">
                  <span className="sn-meta">{k}</span>
                  <span className="body min-w-0 text-right font-bold break-words capitalize">{v}</span>
                </div>
              ))}
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-grid-soft px-4 py-3">
                <span className="sn-meta">{t("res.total_servicio")}</span>
                <span className="sn-price">{formatCOP(montoTotal)}</span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-line bg-signal px-4 py-3 text-ink">
                <span className="sn-label">{t("res.anticipo_ahora")}</span>
                <span className="sn-fig text-[22px]">{formatCOP(sena)}</span>
              </div>
            </div>
            {sena < montoTotal ? (
              <p className="sn-meta m-0 px-4 pt-2">{t("res.saldo_local", { monto: formatCOP(montoTotal - sena) })}</p>
            ) : null}

            {/* Nunca se paga sin ver antes la política de cancelación. */}
            <div className="p-sec">
              <Num>{t("res.politica")}</Num>
            </div>
            <ul className="body-sm m-0 flex list-none flex-col gap-1.5 px-4">
              {resumenPoliticaCancelacion(negocio).map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? (
          <div className="px-4 pt-4">
            <Status tone="err" role="alert" className="!whitespace-normal">
              {error}
            </Status>
          </div>
        ) : null}
      </main>

      {/* ── Barra de acción ───────────────────────────────────────── */}
      <div className="p-foot">
        {paso < 4 && (paso === 1 ? montoTotal > 0 : true) ? bloqueAnticipo : null}
        {paso < 4 ? (
          <Button
            size="lg"
            className="w-full justify-between"
            disabled={!puedeAvanzar}
            onClick={() => {
              setError(null);
              // Profesional preseleccionado desde su perfil: se aplica al salir del paso 1,
              // solo si presta todos los servicios elegidos.
              if (paso === 1 && staffInicial && !staffInicialAplicado) {
                setStaffInicialAplicado(true);
                if (staffCompatible.some((p) => p.staff_id === staffInicial)) setStaffId(staffInicial);
              }
              setPaso((p) => p + 1);
            }}
          >
            <span>{t("comun.continuar")}</span>
            {iconoFlecha}
          </Button>
        ) : (
          <Button size="lg" className="w-full justify-between" loading={confirmando} onClick={confirmar}>
            <span>{sena > 0 ? t("res.ir_pagar", { monto: formatCOP(sena) }) : t("res.confirmar_sin_anticipo")}</span>
            {iconoFlecha}
          </Button>
        )}
      </div>
    </div>
  );
}
