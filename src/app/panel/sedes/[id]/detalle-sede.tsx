"use client";

import {
  cerrarSedeTemporal,
  eliminarExcepcion,
  eliminarSede,
  guardarExcepcion,
  marcarSedePrincipal,
  reabrirSede,
  trasladarStaff,
} from "@/app/panel/sedes/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormularioSede, type SedeExistente } from "@/components/negocio/formulario-sede";
import type { PermisosPanel } from "@/lib/auth/resolver-contexto";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Excepcion {
  id: string;
  fecha: string;
  cerrado: boolean;
  hora_inicio_especial: string | null;
  hora_fin_especial: string | null;
  motivo: string | null;
}
interface StaffDeSede {
  vinculo_id: string;
  staff_id: string;
  nombre: string;
  foto_url: string | null;
  especialidad: string | null;
  es_guardian: boolean;
  nivel: string | null;
}
interface OtraSede {
  id: string;
  nombre: string;
}

export function DetalleSede({
  sede,
  negocioId,
  permisos,
  excepcionesIniciales,
  staffInicial,
  otrasSedes,
}: {
  sede: SedeExistente & {
    es_principal: boolean;
    cerrada_temporalmente: boolean;
    cerrada_permanente: boolean;
  };
  negocioId: string;
  /** ADR-006: Guardian edita su sede y el horario, pero nunca cierra,
   * elimina, marca principal ni traslada Staff — acciones exclusivas de
   * Barbería (03-Business-Rules/01_Roles.md). Se ocultan por completo acá,
   * no solo se deshabilitan — y las RPCs las rechazan igual del lado del
   * servidor si alguien las llamara directo. */
  permisos: PermisosPanel;
  excepcionesIniciales: Excepcion[];
  staffInicial: StaffDeSede[];
  otrasSedes: OtraSede[];
}) {
  const router = useRouter();
  const [excepciones, setExcepciones] = useState(excepcionesIniciales);
  const [staff, setStaff] = useState(staffInicial);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);

  const operativa = !sede.cerrada_permanente && !sede.cerrada_temporalmente;

  async function onCerrarTemporal() {
    if (!confirm("¿Cerrar esta sede temporalmente? No se podrán crear nuevas reservas hasta reabrirla.")) return;
    setAccionando(true);
    setError(null);
    const res = await cerrarSedeTemporal(sede.id);
    setAccionando(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  async function onReabrir() {
    setAccionando(true);
    setError(null);
    const res = await reabrirSede(sede.id);
    setAccionando(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  async function onEliminar() {
    if (
      !confirm(
        "¿Eliminar esta sede? Quedará cerrada permanentemente. No se puede eliminar si tiene reservas activas."
      )
    )
      return;
    setAccionando(true);
    setError(null);
    const res = await eliminarSede(sede.id);
    setAccionando(false);
    if (!res.ok) return setError(res.error);
    router.push("/panel/sedes");
  }

  async function onMarcarPrincipal() {
    setAccionando(true);
    setError(null);
    const res = await marcarSedePrincipal(sede.id);
    setAccionando(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
      {error ? (
        <p role="alert" className="mb-4 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {/* ── Estado operativo ──────────────────────────────────────────── */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-bold text-text">Estado</p>
          {sede.cerrada_permanente ? (
            <Badge tone="danger">ELIMINADA</Badge>
          ) : sede.cerrada_temporalmente ? (
            <Badge tone="danger">CERRADA TEMPORALMENTE</Badge>
          ) : (
            <Badge tone="success">OPERATIVA</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {sede.es_principal ? (
            <Badge tone="accent">SEDE PRINCIPAL</Badge>
          ) : operativa && permisos.marcarSedePrincipal ? (
            <Button size="sm" variant="secondary" loading={accionando} onClick={onMarcarPrincipal}>
              Marcar como principal
            </Button>
          ) : null}

          {permisos.cerrarReabrirSede &&
            (operativa ? (
              <Button size="sm" variant="secondary" loading={accionando} onClick={onCerrarTemporal}>
                Cerrar temporalmente
              </Button>
            ) : sede.cerrada_permanente ? null : (
              <Button size="sm" variant="secondary" loading={accionando} onClick={onReabrir}>
                Reabrir
              </Button>
            ))}

          {permisos.eliminarSede && !sede.cerrada_permanente ? (
            <Button size="sm" variant="danger" loading={accionando} onClick={onEliminar}>
              Eliminar sede
            </Button>
          ) : null}

          {!permisos.cerrarReabrirSede && !permisos.eliminarSede ? (
            <p className="text-[11.5px] text-text-faint">
              Solo la Barbería puede cerrar, reabrir o eliminar una sede.
            </p>
          ) : null}
        </div>
      </Card>

      {/* ── Staff en esta sede + traslado ─────────────────────────────── */}
      <section className="mb-6">
        <h2 className="font-display mb-3 text-[15px] font-bold uppercase text-text">
          Staff en esta sede
        </h2>
        {staff.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
            Ningún Staff tiene esta sede como sede activa todavía.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {staff.map((s) => (
              <StaffRow
                key={s.vinculo_id}
                staff={s}
                otrasSedes={otrasSedes}
                onTrasladado={(vinculoId) => {
                  setStaff((prev) => prev.filter((x) => x.vinculo_id !== vinculoId));
                }}
              />
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-text-faint">
          Invitar y gestionar el resto del Staff es el Módulo 2.4 — acá solo se administra
          quién ya pertenece a esta sede.
        </p>
      </section>

      {/* ── Excepciones de horario ────────────────────────────────────── */}
      <SeccionExcepciones sedeId={sede.id} excepciones={excepciones} onCambio={setExcepciones} />

      {/* ── Editar datos ──────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display mb-3 text-[15px] font-bold uppercase text-text">
          Editar sede
        </h2>
        <FormularioSede
          negocioId={negocioId}
          sedeExistente={sede}
          textoBoton="GUARDAR CAMBIOS"
          onGuardado={() => router.refresh()}
        />
      </section>
    </main>
  );
}

function StaffRow({
  staff,
  otrasSedes,
  onTrasladado,
}: {
  staff: StaffDeSede;
  otrasSedes: OtraSede[];
  onTrasladado: (vinculoId: string) => void;
}) {
  const [trasladando, setTrasladando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destino, setDestino] = useState("");

  async function onTrasladar() {
    if (!destino) return;
    setTrasladando(true);
    setError(null);
    const res = await trasladarStaff(staff.vinculo_id, destino);
    setTrasladando(false);
    if (!res.ok) return setError(res.error);
    onTrasladado(staff.vinculo_id);
  }

  return (
    <li className="rounded-2xl border border-border-subtle bg-surface p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text">{staff.nombre}</p>
          <p className="truncate text-[11.5px] text-text-faint">
            {staff.especialidad ?? "Sin especialidad"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {staff.es_guardian ? <Badge tone="accent">GUARDIAN</Badge> : null}
          {staff.nivel ? <Badge tone="neutral">{staff.nivel}</Badge> : null}
        </div>
      </div>

      {otrasSedes.length > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none focus:border-accent/60"
          >
            <option value="">Trasladar a...</option>
            {otrasSedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <Button size="sm" variant="secondary" disabled={!destino} loading={trasladando} onClick={onTrasladar}>
            Trasladar
          </Button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[11.5px] text-danger">{error}</p> : null}
    </li>
  );
}

function SeccionExcepciones({
  sedeId,
  excepciones,
  onCambio,
}: {
  sedeId: string;
  excepciones: Excepcion[];
  onCambio: (e: Excepcion[]) => void;
}) {
  const [fecha, setFecha] = useState("");
  const [cerrado, setCerrado] = useState(true);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("18:00");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha) return;
    setGuardando(true);
    setError(null);
    const res = await guardarExcepcion({
      sedeId,
      fecha,
      cerrado,
      horaInicio: cerrado ? null : horaInicio,
      horaFin: cerrado ? null : horaFin,
      motivo,
    });
    setGuardando(false);
    if (!res.ok) return setError(res.error);

    onCambio(
      [
        ...excepciones.filter((x) => x.fecha !== fecha),
        {
          id: crypto.randomUUID(),
          fecha,
          cerrado,
          hora_inicio_especial: cerrado ? null : horaInicio,
          hora_fin_especial: cerrado ? null : horaFin,
          motivo: motivo || null,
        },
      ].sort((a, b) => a.fecha.localeCompare(b.fecha))
    );
    setFecha("");
    setMotivo("");
  }

  async function onEliminar(id: string) {
    const anterior = excepciones;
    onCambio(excepciones.filter((x) => x.id !== id));
    const res = await eliminarExcepcion(id, sedeId);
    if (!res.ok) onCambio(anterior);
  }

  return (
    <section className="mb-6">
      <h2 className="font-display mb-1 text-[15px] font-bold uppercase text-text">
        Festivos y cierres puntuales
      </h2>
      <p className="mb-3 text-[12px] text-text-faint">
        Días distintos al horario semanal general — un festivo, una remodelación, un
        horario reducido de fin de año. Se reflejan de inmediato en la disponibilidad
        que ve el Cliente.
      </p>

      {excepciones.length > 0 ? (
        <ul className="mb-3 flex flex-col gap-2">
          {excepciones.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-text">
                  {new Date(`${ex.fecha}T12:00:00`).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  —{" "}
                  {ex.cerrado
                    ? "Cerrado"
                    : `${ex.hora_inicio_especial?.slice(0, 5)} a ${ex.hora_fin_especial?.slice(0, 5)}`}
                </p>
                {ex.motivo ? (
                  <p className="truncate text-[11.5px] text-text-faint">{ex.motivo}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onEliminar(ex.id)}
                className="shrink-0 text-[11.5px] font-semibold text-danger"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onAgregar} className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
        <Input
          label="Fecha"
          type="date"
          required
          min={new Date().toISOString().slice(0, 10)}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCerrado(true)}
            aria-pressed={cerrado}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors",
              cerrado ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
            )}
          >
            Cerrado todo el día
          </button>
          <button
            type="button"
            onClick={() => setCerrado(false)}
            aria-pressed={!cerrado}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors",
              !cerrado ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
            )}
          >
            Horario especial
          </button>
        </div>
        {!cerrado ? (
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-2 py-2 text-[12.5px] text-text"
            />
            <span className="text-text-faint">–</span>
            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-2 py-2 text-[12.5px] text-text"
            />
          </div>
        ) : null}
        <Input
          label="Motivo (opcional)"
          placeholder="Festivo, remodelación..."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <Button type="submit" variant="secondary" loading={guardando} className="w-full">
          AGREGAR
        </Button>
      </form>
    </section>
  );
}
