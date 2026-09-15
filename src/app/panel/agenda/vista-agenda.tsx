"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { duracion, hora, sumarDias } from "@/lib/formato";
import { formatCOP } from "@/lib/utils";
import { Fragment, useCallback, useEffect, useState, useTransition } from "react";
import { useEnLinea } from "@/lib/hooks/use-en-linea";
import {
  buscarClienteExistente,
  cancelarCita,
  crearBloqueo,
  crearCitaManual,
  eliminarBloqueo,
  listarBloqueos,
  listarCitas,
  listarServiciosActivos,
  obtenerSlotsAgenda,
  reasignarStaff,
  reprogramarCita,
  type BloqueoAgenda,
  type CitaAgenda,
  type ClienteEncontrado,
} from "./actions";

const DIAS_SEMANA = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"] as const;
const DIAS_ETIQUETA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface StaffSede {
  vinculoId: string;
  staffId: string;
  nombre: string;
  fotoUrl: string | null;
}
interface Sede {
  id: string;
  nombre: string;
  horarioBase: unknown;
  zonaHoraria: string;
}

function inicioDiaISO(fecha: string) {
  return new Date(`${fecha}T00:00:00-05:00`).toISOString();
}
function lunesDeLaSemana(fecha: string) {
  const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0=domingo
  const offset = dow === 0 ? -6 : 1 - dow;
  return sumarDias(fecha, offset);
}
function ventanaDelDia(horarioBase: unknown, fecha: string): { inicio: number; fin: number } {
  const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  const clave = DIAS_SEMANA[dow];
  const ventanas = (horarioBase as Record<string, [string, string][]> | null)?.[clave] ?? [];
  if (ventanas.length === 0) return { inicio: 7 * 60, fin: 21 * 60 };
  const aMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const inicio = Math.min(...ventanas.map((v) => aMin(v[0])));
  const fin = Math.max(...ventanas.map((v) => aMin(v[1])));
  return { inicio, fin };
}

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  PENDIENTE_PAGO: "neutral",
  CONFIRMADA: "accent",
  EN_CURSO: "success",
  COMPLETADA: "success",
  NO_SHOW: "danger",
};

export function VistaAgenda({
  negocioId,
  sedes,
  sede,
  staff,
}: {
  negocioId: string;
  /** null para Guardian — su sede es fija, no hay selector. */
  sedes: { id: string; nombre: string }[] | null;
  sede: Sede;
  staff: StaffSede[];
}) {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [fecha, setFecha] = useState(hoy);
  const [vista, setVista] = useState<"dia" | "semana">("dia");
  const [citas, setCitas] = useState<CitaAgenda[]>([]);
  const [bloqueos, setBloqueos] = useState<BloqueoAgenda[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enLinea = useEnLinea();
  const [, iniciarCarga] = useTransition();

  const [citaSeleccionada, setCitaSeleccionada] = useState<CitaAgenda | null>(null);
  const [mostrarNuevaCita, setMostrarNuevaCita] = useState(false);
  const [mostrarBloqueo, setMostrarBloqueo] = useState(false);

  const rango =
    vista === "dia"
      ? { desde: fecha, hasta: sumarDias(fecha, 1) }
      : { desde: lunesDeLaSemana(fecha), hasta: sumarDias(lunesDeLaSemana(fecha), 7) };

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [resCitas, resBloqueos] = await Promise.all([
      listarCitas(sede.id, inicioDiaISO(rango.desde), inicioDiaISO(rango.hasta)),
      listarBloqueos(
        staff.map((s) => s.vinculoId),
        inicioDiaISO(rango.desde),
        inicioDiaISO(rango.hasta)
      ),
    ]);
    setCargando(false);
    if (!resCitas.ok) return setError(resCitas.error);
    setCitas(resCitas.data);
    if (resBloqueos.ok) setBloqueos(resBloqueos.data);
  }, [sede.id, rango.desde, rango.hasta, staff]);

  useEffect(() => {
    iniciarCarga(() => {
      cargar();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede.id, fecha, vista]);

  function cambiarSede(sedeId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("sede", sedeId);
    window.location.href = url.toString();
  }

  async function onReasignar(citaId: string, nuevoStaffId: string) {
    setError(null);
    const res = await reasignarStaff(citaId, nuevoStaffId);
    if (!res.ok) return setError(res.error);
    cargar();
  }

  async function onQuitarBloqueo(id: string) {
    setError(null);
    const res = await eliminarBloqueo(id);
    if (!res.ok) return setError(res.error);
    cargar();
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold uppercase text-text">Agenda</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">{sede.nombre}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sedes && sedes.length > 1 ? (
            <select
              value={sede.id}
              onChange={(e) => cambiarSede(e.target.value)}
              className="h-9 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none"
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => setMostrarBloqueo(true)}>
            Bloquear horario
          </Button>
          <Button size="sm" onClick={() => setMostrarNuevaCita(true)}>
            + Nueva cita
          </Button>
        </div>
      </div>

      {!enLinea ? (
        <Card className="mb-4 border-danger/30 bg-danger-soft">
          <p className="text-[12.5px] font-semibold text-danger">Sin conexión — la agenda no se va a actualizar.</p>
        </Card>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setFecha((f) => sumarDias(f, vista === "dia" ? -1 : -7))}>
            ←
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setFecha(hoy)}>
            Hoy
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setFecha((f) => sumarDias(f, vista === "dia" ? 1 : 7))}>
            →
          </Button>
          <p className="ml-2 text-[13px] font-semibold text-text">
            {vista === "dia"
              ? new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
              : `Semana del ${lunesDeLaSemana(fecha)}`}
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-border p-1">
          <button
            type="button"
            onClick={() => setVista("dia")}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${vista === "dia" ? "bg-accent text-bg" : "text-text-muted"}`}
          >
            Día
          </button>
          <button
            type="button"
            onClick={() => setVista("semana")}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${vista === "semana" ? "bg-accent text-bg" : "text-text-muted"}`}
          >
            Semana
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-3 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {staff.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          Esta sede todavía no tiene Staff activo — no hay columnas para mostrar.
        </p>
      ) : cargando ? (
        <div className="h-[400px] animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : vista === "dia" ? (
        <DiaGrid
          fecha={fecha}
          sede={sede}
          staff={staff}
          citas={citas}
          bloqueos={bloqueos}
          onSeleccionar={setCitaSeleccionada}
          onReasignar={onReasignar}
          onQuitarBloqueo={onQuitarBloqueo}
        />
      ) : (
        <SemanaGrid
          lunes={lunesDeLaSemana(fecha)}
          staff={staff}
          citas={citas}
          onSeleccionarDia={(f) => {
            setFecha(f);
            setVista("dia");
          }}
        />
      )}

      {citaSeleccionada ? (
        <PanelCita
          cita={citaSeleccionada}
          sedeId={sede.id}
          staff={staff}
          onCerrar={() => setCitaSeleccionada(null)}
          onCambio={() => {
            setCitaSeleccionada(null);
            cargar();
          }}
        />
      ) : null}

      {mostrarNuevaCita ? (
        <FormularioNuevaCita
          negocioId={negocioId}
          sedeId={sede.id}
          staff={staff}
          fechaInicial={fecha}
          onCerrar={() => setMostrarNuevaCita(false)}
          onCreada={() => {
            setMostrarNuevaCita(false);
            cargar();
          }}
        />
      ) : null}

      {mostrarBloqueo ? (
        <FormularioBloqueo
          staff={staff}
          onCerrar={() => setMostrarBloqueo(false)}
          onCreado={() => {
            setMostrarBloqueo(false);
            cargar();
          }}
        />
      ) : null}
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Vista Día — columnas por Staff, cuadrícula de 30 min, drag & drop entre
// columnas para reasignar Staff (mismo horario). Reprogramar el horario
// usa un formulario explícito (PanelCita), no arrastre libre de píxeles.
// ════════════════════════════════════════════════════════════════════════

function DiaGrid({
  fecha,
  sede,
  staff,
  citas,
  bloqueos,
  onSeleccionar,
  onReasignar,
  onQuitarBloqueo,
}: {
  fecha: string;
  sede: Sede;
  staff: StaffSede[];
  citas: CitaAgenda[];
  bloqueos: BloqueoAgenda[];
  onSeleccionar: (c: CitaAgenda) => void;
  onReasignar: (citaId: string, nuevoStaffId: string) => void;
  onQuitarBloqueo: (id: string) => void;
}) {
  const { inicio, fin } = ventanaDelDia(sede.horarioBase, fecha);
  const totalSlots = Math.max(1, Math.ceil((fin - inicio) / 30));
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  function slotDe(iso: string) {
    const d = new Date(iso);
    const minutos = d.getUTCHours() * 60 + d.getUTCMinutes() - 5 * 60; // UTC-5 fijo
    const minutosNorm = ((minutos % 1440) + 1440) % 1440;
    return Math.floor((minutosNorm - inicio) / 30);
  }

  const etiquetas: string[] = [];
  for (let m = inicio; m < fin; m += 60) {
    const h = Math.floor(m / 60);
    etiquetas.push(`${String(h).padStart(2, "0")}:00`);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface">
      <div
        className="grid min-w-[640px]"
        style={{ gridTemplateColumns: `64px repeat(${staff.length}, minmax(140px, 1fr))` }}
      >
        <div className="sticky top-0 z-10 border-b border-r border-border-subtle bg-surface" />
        {staff.map((s) => (
          <div
            key={s.vinculoId}
            className="sticky top-0 z-10 truncate border-b border-l border-border-subtle bg-surface p-2 text-center text-[12px] font-bold text-text"
          >
            {s.nombre}
          </div>
        ))}

        {/* Etiquetas de hora, en su propia columna, filas independientes del resto */}
        <div className="relative border-r border-border-subtle" style={{ gridRow: `span ${totalSlots}`, height: totalSlots * 24 }}>
          {etiquetas.map((e, i) => (
            <p key={e} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-text-faint" style={{ top: i * 48 }}>
              {e}
            </p>
          ))}
        </div>

        {staff.map((s) => {
          const citasStaff = citas.filter((c) => c.staffId === s.staffId);
          const bloqueosStaff = bloqueos.filter((b) => b.vinculoId === s.vinculoId);
          return (
            <div
              key={s.vinculoId}
              className={`relative border-l border-border-subtle ${arrastrando ? "bg-accent-soft/30" : ""}`}
              style={{ height: totalSlots * 24 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const citaId = e.dataTransfer.getData("text/cita-id");
                const staffOrigen = e.dataTransfer.getData("text/staff-id");
                setArrastrando(null);
                if (citaId && staffOrigen !== s.staffId) onReasignar(citaId, s.staffId);
              }}
            >
              {bloqueosStaff.map((b) => {
                const inicioSlot = Math.max(0, slotDe(b.fechaInicio));
                const finSlot = Math.min(totalSlots, slotDe(b.fechaFin) || totalSlots);
                if (finSlot <= inicioSlot) return null;
                return (
                  <button
                    key={b.id}
                    type="button"
                    title="Tocá para quitar el bloqueo"
                    onClick={() => {
                      if (confirm("¿Quitar este bloqueo de horario?")) onQuitarBloqueo(b.id);
                    }}
                    className="absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(45deg,var(--color-border-subtle),var(--color-border-subtle)_6px,transparent_6px,transparent_12px)] px-1 text-center text-[10px] text-text-faint"
                    style={{ top: inicioSlot * 24, height: (finSlot - inicioSlot) * 24 }}
                  >
                    {b.motivo ?? "Bloqueado"}
                  </button>
                );
              })}
              {citasStaff.map((c) => {
                const inicioSlot = slotDe(c.horaInicio);
                const duracionMin = (new Date(c.horaFin).getTime() - new Date(c.horaInicio).getTime()) / 60000;
                const alto = Math.max(20, (duracionMin / 30) * 24 - 2);
                return (
                  <button
                    key={c.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/cita-id", c.id);
                      e.dataTransfer.setData("text/staff-id", c.staffId ?? "");
                      setArrastrando(c.id);
                    }}
                    onDragEnd={() => setArrastrando(null)}
                    onClick={() => onSeleccionar(c)}
                    className={`absolute inset-x-0.5 overflow-hidden rounded-md border-l-4 p-1 text-left text-[10.5px] leading-tight shadow-sm ${
                      c.estado === "NO_SHOW"
                        ? "border-danger bg-danger-soft"
                        : c.estado === "CONFIRMADA"
                          ? "border-accent bg-accent-soft"
                          : "border-text-faint bg-surface-2"
                    }`}
                    style={{ top: inicioSlot * 24 + 1, height: alto }}
                  >
                    <span className="block truncate font-bold text-text">{hora(c.horaInicio)} {c.clienteNombre}</span>
                    <span className="block truncate text-text-faint">{c.servicios}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="border-t border-border-subtle p-2 text-center text-[11px] text-text-faint">
        Arrastrá una cita a otra columna para reasignarla a otro Staff (mismo horario) · tocá una cita para reprogramar, cancelar o ver el detalle.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Vista Semana — columnas por Staff, una fila por día (02-UX/09_Business_
// Panel.md: "Vista semanal por Staff (columnas)").
// ════════════════════════════════════════════════════════════════════════

function SemanaGrid({
  lunes,
  staff,
  citas,
  onSeleccionarDia,
}: {
  lunes: string;
  staff: StaffSede[];
  citas: CitaAgenda[];
  onSeleccionarDia: (fecha: string) => void;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `72px repeat(${staff.length}, minmax(140px, 1fr))` }}>
        <div className="border-b border-r border-border-subtle bg-surface-2 p-2" />
        {staff.map((s) => (
          <div key={s.vinculoId} className="truncate border-b border-l border-border-subtle bg-surface-2 p-2 text-center text-[12px] font-bold text-text">
            {s.nombre}
          </div>
        ))}
        {dias.map((d) => (
          <Fragment key={d}>
            <button
              type="button"
              onClick={() => onSeleccionarDia(d)}
              className="border-b border-r border-border-subtle p-2 text-center text-[11px] font-semibold text-text-muted hover:bg-surface-2"
            >
              {DIAS_ETIQUETA[new Date(`${d}T12:00:00Z`).getUTCDay()]}
              <br />
              {Number(d.slice(8, 10))}
            </button>
            {staff.map((s) => {
              const citasDelDia = citas.filter((c) => c.staffId === s.staffId && localDia(c.horaInicio) === d);
              return (
                <button
                  key={`${d}-${s.vinculoId}`}
                  type="button"
                  onClick={() => onSeleccionarDia(d)}
                  className="min-h-[64px] border-b border-l border-border-subtle p-1 text-left align-top hover:bg-surface-2"
                >
                  <div className="flex flex-col gap-1">
                    {citasDelDia.slice(0, 3).map((c) => (
                      <span key={c.id} className="truncate rounded bg-accent-soft px-1 py-0.5 text-[9.5px] font-semibold text-accent">
                        {hora(c.horaInicio)} {c.clienteNombre}
                      </span>
                    ))}
                    {citasDelDia.length > 3 ? (
                      <span className="text-[9.5px] text-text-faint">+{citasDelDia.length - 3} más</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function localDia(iso: string) {
  // UTC-5 fijo (Colombia, sin horario de verano) — mismo criterio que el resto del módulo.
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// ════════════════════════════════════════════════════════════════════════
// Panel de una cita: reprogramar / reasignar / cancelar / detalle.
// ════════════════════════════════════════════════════════════════════════

function PanelCita({
  cita,
  sedeId,
  staff,
  onCerrar,
  onCambio,
}: {
  cita: CitaAgenda;
  sedeId: string;
  staff: StaffSede[];
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [accion, setAccion] = useState<"detalle" | "reprogramar" | "reasignar" | "cancelar">("detalle");
  const [nuevaFecha, setNuevaFecha] = useState(cita.horaInicio.slice(0, 10));
  const [slotsDisponibles, setSlotsDisponibles] = useState<{ horaInicio: string }[]>([]);
  const [horaElegida, setHoraElegida] = useState("");
  const [nuevoStaffId, setNuevoStaffId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarSlotsReprogramar(fecha: string) {
    setCargando(true);
    const res = await obtenerSlotsAgenda({
      sedeId,
      servicioIds: cita.servicioIds,
      fechaISO: fecha,
      staffId: cita.staffId,
    });
    setCargando(false);
    if (res.ok) setSlotsDisponibles(res.data);
  }

  async function onConfirmarReprogramar() {
    if (!horaElegida) return;
    setCargando(true);
    setError(null);
    const res = await reprogramarCita(cita.id, horaElegida, motivo);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    onCambio();
  }

  async function onConfirmarReasignar() {
    if (!nuevoStaffId) return;
    setCargando(true);
    setError(null);
    const res = await reasignarStaff(cita.id, nuevoStaffId, motivo);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    onCambio();
  }

  async function onConfirmarCancelar() {
    setCargando(true);
    setError(null);
    const res = await cancelarCita(cita.id, motivo);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    onCambio();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCerrar}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[15px] font-bold text-text">{cita.clienteNombre}</p>
          <Badge tone={ESTADO_TONO[cita.estado] ?? "neutral"}>{cita.estado}</Badge>
        </div>
        <p className="text-[12.5px] text-text-muted">
          {hora(cita.horaInicio)}–{hora(cita.horaFin)} · {cita.servicios}
        </p>
        <p className="mt-1 text-[12.5px] text-text-muted">{formatCOP(cita.montoTotal)}</p>
        {cita.clienteTelefono ? <p className="mt-1 text-[12px] text-text-faint">{cita.clienteTelefono}</p> : null}

        {error ? <p className="mt-3 text-[12.5px] font-semibold text-danger">{error}</p> : null}

        {accion === "detalle" ? (
          <div className="mt-5 flex flex-col gap-2">
            {cita.estado === "CONFIRMADA" ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAccion("reprogramar");
                    cargarSlotsReprogramar(nuevaFecha);
                  }}
                >
                  Reprogramar
                </Button>
                <Button variant="secondary" onClick={() => setAccion("reasignar")}>
                  Reasignar Staff
                </Button>
              </>
            ) : null}
            {cita.estado !== "COMPLETADA" && cita.estado !== "NO_SHOW" ? (
              <Button variant="danger" onClick={() => setAccion("cancelar")}>
                Cancelar reserva
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onCerrar}>
              Cerrar
            </Button>
          </div>
        ) : accion === "reprogramar" ? (
          <div className="mt-5 flex flex-col gap-3">
            <Input
              label="Nueva fecha"
              type="date"
              value={nuevaFecha}
              onChange={(e) => {
                setNuevaFecha(e.target.value);
                setHoraElegida("");
                cargarSlotsReprogramar(e.target.value);
              }}
            />
            {cargando ? (
              <p className="text-[12px] text-text-faint">Buscando horarios...</p>
            ) : slotsDisponibles.length === 0 ? (
              <p className="text-[12px] text-text-faint">Sin horarios disponibles ese día.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slotsDisponibles.map((s) => (
                  <button
                    key={s.horaInicio}
                    type="button"
                    onClick={() => setHoraElegida(s.horaInicio)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                      horaElegida === s.horaInicio ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
                    }`}
                  >
                    {hora(s.horaInicio)}
                  </button>
                ))}
              </div>
            )}
            <Button loading={cargando} disabled={!horaElegida} onClick={onConfirmarReprogramar}>
              Confirmar
            </Button>
            <Button variant="ghost" onClick={() => setAccion("detalle")}>
              Volver
            </Button>
          </div>
        ) : accion === "reasignar" ? (
          <div className="mt-5 flex flex-col gap-3">
            <select
              value={nuevoStaffId}
              onChange={(e) => setNuevoStaffId(e.target.value)}
              className="h-12 rounded-xl border border-border bg-bg px-3 text-[13.5px] text-text"
            >
              <option value="">Elegí un Staff...</option>
              {staff.filter((s) => s.staffId !== cita.staffId).map((s) => (
                <option key={s.staffId} value={s.staffId}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <Button loading={cargando} disabled={!nuevoStaffId} onClick={onConfirmarReasignar}>
              Confirmar
            </Button>
            <Button variant="ghost" onClick={() => setAccion("detalle")}>
              Volver
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <Input label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <p className="text-[11.5px] text-text-faint">
              Cancelar desde el negocio siempre reembolsa el 100% de la Seña al Cliente.
            </p>
            <Button variant="danger" loading={cargando} onClick={onConfirmarCancelar}>
              Confirmar cancelación
            </Button>
            <Button variant="ghost" onClick={() => setAccion("detalle")}>
              Volver
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Nueva cita manual ("reserva telefónica") — mismas 7 validaciones, vía
// slots_disponibles/crear_reserva_manual.
// ════════════════════════════════════════════════════════════════════════

function FormularioNuevaCita({
  negocioId,
  sedeId,
  staff,
  fechaInicial,
  onCerrar,
  onCreada,
}: {
  negocioId: string;
  sedeId: string;
  staff: StaffSede[];
  fechaInicial: string;
  onCerrar: () => void;
  onCreada: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [clientes, setClientes] = useState<ClienteEncontrado[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [servicios, setServicios] = useState<{ id: string; nombre: string; duracionMinutos: number; precioBase: number }[]>([]);
  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string>("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [slots, setSlots] = useState<{ horaInicio: string }[]>([]);
  const [horaElegida, setHoraElegida] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarServiciosActivos(negocioId).then((res) => {
      if (res.ok) setServicios(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onBuscar(valor: string) {
    setBusqueda(valor);
    if (valor.trim().length < 2) return setClientes([]);
    setBuscando(true);
    const res = await buscarClienteExistente(negocioId, valor);
    setBuscando(false);
    if (res.ok) setClientes(res.data);
  }

  async function onCargarSlots() {
    if (servicioIds.length === 0) return;
    setCargandoSlots(true);
    setHoraElegida("");
    const res = await obtenerSlotsAgenda({ sedeId, servicioIds, fechaISO: fecha, staffId: staffId || null });
    setCargandoSlots(false);
    if (res.ok) setSlots(res.data);
  }

  async function onCrear() {
    if (!clienteId || !horaElegida || servicioIds.length === 0) return;
    setCreando(true);
    setError(null);
    const res = await crearCitaManual({
      sedeId,
      servicioIds,
      horaInicio: horaElegida,
      clienteId,
      staffId: staffId || null,
    });
    setCreando(false);
    if (!res.ok) return setError(res.error);
    onCreada();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCerrar}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-[15px] font-bold text-text">Nueva cita manual</p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Cliente</label>
            <Input
              placeholder="Buscar por nombre, teléfono o correo..."
              value={busqueda}
              onChange={(e) => onBuscar(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-text-faint">
              Solo aparecen clientes que ya tuvieron alguna reserva con vos antes.
            </p>
            {buscando ? <p className="mt-1 text-[11.5px] text-text-faint">Buscando...</p> : null}
            {clientes.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {clientes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setClienteId(c.id);
                        setBusqueda(c.nombre);
                        setClientes([]);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-[12.5px] ${
                        clienteId === c.id ? "border-accent bg-accent-soft" : "border-border"
                      }`}
                    >
                      <span className="font-semibold text-text">{c.nombre}</span>{" "}
                      <span className="text-text-faint">{c.telefono ?? c.email ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Servicios</label>
            <div className="flex flex-col gap-1.5">
              {servicios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setServicioIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                  }
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left ${
                    servicioIds.includes(s.id) ? "border-accent bg-accent-soft" : "border-border"
                  }`}
                >
                  <span className="text-[12.5px] font-semibold text-text">{s.nombre}</span>
                  <span className="text-[11px] text-text-faint">
                    {duracion(s.duracionMinutos)} · {formatCOP(s.precioBase)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Staff (opcional)</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-bg px-3 text-[13.5px] text-text"
            >
              <option value="">Cualquiera disponible</option>
              {staff.map((s) => (
                <option key={s.staffId} value={s.staffId}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Button variant="secondary" onClick={onCargarSlots} disabled={servicioIds.length === 0}>
            Ver horarios disponibles
          </Button>

          {cargandoSlots ? (
            <p className="text-[12px] text-text-faint">Buscando...</p>
          ) : slots.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <button
                  key={s.horaInicio}
                  type="button"
                  onClick={() => setHoraElegida(s.horaInicio)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                    horaElegida === s.horaInicio ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
                  }`}
                >
                  {hora(s.horaInicio)}
                </button>
              ))}
            </div>
          ) : null}

          {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}

          <Button loading={creando} disabled={!clienteId || !horaElegida} onClick={onCrear}>
            Crear cita
          </Button>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Bloquear horario (vacaciones, ausencias) — crea bloqueo_ausencia directo.
// ════════════════════════════════════════════════════════════════════════

function FormularioBloqueo({
  staff,
  onCerrar,
  onCreado,
}: {
  staff: StaffSede[];
  onCerrar: () => void;
  onCreado: () => void;
}) {
  const [vinculoId, setVinculoId] = useState(staff[0]?.vinculoId ?? "");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGuardar() {
    if (!vinculoId || !fechaInicio || !fechaFin) return;
    setGuardando(true);
    setError(null);
    const res = await crearBloqueo({
      vinculoId,
      fechaInicio: new Date(`${fechaInicio}T00:00:00-05:00`).toISOString(),
      fechaFin: new Date(`${fechaFin}T23:59:59-05:00`).toISOString(),
      motivo,
    });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    onCreado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-t-3xl bg-bg p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-[15px] font-bold text-text">Bloquear horario</p>
        <div className="flex flex-col gap-3">
          <select
            value={vinculoId}
            onChange={(e) => setVinculoId(e.target.value)}
            className="h-12 rounded-xl border border-border bg-bg px-3 text-[13.5px] text-text"
          >
            {staff.map((s) => (
              <option key={s.vinculoId} value={s.vinculoId}>
                {s.nombre}
              </option>
            ))}
          </select>
          <Input label="Desde" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          <Input label="Hasta" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          <Input label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}
          <Button loading={guardando} disabled={!fechaInicio || !fechaFin} onClick={onGuardar}>
            Bloquear
          </Button>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

