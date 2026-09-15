"use client";

import { trasladarStaff } from "@/app/panel/sedes/actions";
import {
  promoverGuardian,
  reactivarStaff,
  retirarStaff,
  revocarGuardian,
  suspenderStaff,
  type EventoHistorial,
} from "@/app/panel/staff/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import type { PermisosPanel } from "@/lib/auth/resolver-contexto";
import type { Database } from "@/types/database";
import { useRouter } from "next/navigation";
import { useState } from "react";

type StaffVista = Database["public"]["Views"]["vista_staff_negocio"]["Row"];

const ETIQUETA_ACCION: Record<string, string> = {
  STAFF_INVITADO: "Invitado",
  STAFF_INVITACION_REENVIADA: "Invitación reenviada",
  STAFF_INVITACION_CANCELADA: "Invitación cancelada",
  STAFF_INVITACION_RECHAZADA: "Rechazó la invitación",
  STAFF_VINCULADO: "Aceptó la invitación — ingresó al equipo",
  STAFF_TRASLADADO: "Trasladado de sede",
  STAFF_PROMOVIDO_GUARDIAN: "Promovido a Guardian",
  STAFF_GUARDIAN_REVOCADO: "Se le retiró el perfil Guardian",
  STAFF_SUSPENDIDO: "Suspendido",
  STAFF_REACTIVADO: "Reactivado",
  STAFF_RETIRADO: "Se le retiró el acceso",
};

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral"> = {
  ACTIVO: "success",
  SUSPENDIDO: "danger",
  RETIRADO: "neutral",
  INVITADO: "neutral",
};

export function DetalleStaff({
  staff,
  permisos,
  otrasSedes,
  historialInicial,
}: {
  staff: StaffVista;
  permisos: PermisosPanel;
  otrasSedes: { id: string; nombre: string }[];
  historialInicial: EventoHistorial[];
}) {
  const router = useRouter();
  const [historial] = useState(historialInicial);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [destino, setDestino] = useState("");

  const activo = staff.estado === "ACTIVO";
  const suspendido = staff.estado === "SUSPENDIDO";
  const retirado = staff.estado === "RETIRADO";

  async function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setAccionando(true);
    setError(null);
    const res = await fn();
    setAccionando(false);
    if (!res.ok) return setError(res.error ?? "Error inesperado.");
    router.refresh();
  }

  async function onPromover() {
    if (!confirm(`¿Dar el perfil Guardian a ${staff.nombre}? Va a poder administrar toda su sede.`)) return;
    ejecutar(() => promoverGuardian(staff.vinculo_id!));
  }
  async function onRevocar() {
    if (!confirm(`¿Quitarle el perfil Guardian a ${staff.nombre}?`)) return;
    ejecutar(() => revocarGuardian(staff.vinculo_id!));
  }
  async function onSuspender() {
    const motivo = prompt(`¿Por qué suspendés a ${staff.nombre}? (opcional)`) ?? undefined;
    ejecutar(() => suspenderStaff(staff.vinculo_id!, motivo));
  }
  async function onReactivar() {
    ejecutar(() => reactivarStaff(staff.vinculo_id!));
  }
  async function onRetirar() {
    if (
      !confirm(
        `¿Eliminar el acceso de ${staff.nombre}? Pierde el acceso al instante. Su historial se conserva.`
      )
    )
      return;
    const motivo = prompt("Motivo (opcional)") ?? undefined;
    setAccionando(true);
    setError(null);
    const res = await retirarStaff(staff.vinculo_id!, motivo);
    setAccionando(false);
    if (!res.ok) return setError(res.error);
    router.push("/panel/staff");
  }
  async function onTrasladar() {
    if (!destino) return;
    ejecutar(() => trasladarStaff(staff.vinculo_id!, destino));
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
      {error ? (
        <p role="alert" className="mb-4 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {/* ── Ficha ─────────────────────────────────────────────────────── */}
      <Card className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[16px] font-bold text-text">{staff.nombre}</p>
              {staff.es_guardian ? <Badge tone="accent">GUARDIAN</Badge> : null}
              {staff.nivel ? <Badge tone="neutral">{staff.nivel}</Badge> : null}
            </div>
            <p className="mt-1 text-[12.5px] text-text-faint">
              {staff.especialidad ?? "Sin profesión definida"}
            </p>
          </div>
          <Badge tone={ESTADO_TONO[staff.estado ?? "ACTIVO"]}>{staff.estado}</Badge>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4 text-[12.5px]">
          <div>
            <dt className="text-text-faint">Teléfono</dt>
            <dd className="mt-0.5 font-semibold text-text">{staff.telefono ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-faint">Correo</dt>
            <dd className="mt-0.5 truncate font-semibold text-text">{staff.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-faint">Sede</dt>
            <dd className="mt-0.5 font-semibold text-text">{staff.sede_nombre ?? "Sin sede asignada"}</dd>
          </div>
          <div>
            <dt className="text-text-faint">Ingresó</dt>
            <dd className="mt-0.5 font-semibold text-text">
              {staff.fecha_ingreso
                ? new Date(staff.fecha_ingreso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-text-faint">Comisión</dt>
            <dd className="mt-0.5 font-semibold text-text">
              {staff.comision_pct != null ? `${staff.comision_pct}%` : "Sin definir"}
            </dd>
          </div>
        </dl>
        {permisos.suspenderStaff ? (
          <p className="mt-3 text-[11px] text-text-faint">
            Configurar comisiones vive en el módulo de Finanzas (2.10) — acá solo se muestra.
          </p>
        ) : null}
      </Card>

      {/* ── Acciones ──────────────────────────────────────────────────── */}
      {(permisos.promoverGuardian || permisos.suspenderStaff || permisos.retirarStaff) && !retirado ? (
        <Card className="mb-6">
          <p className="mb-3 text-[13px] font-bold text-text">Acciones</p>
          <div className="flex flex-wrap gap-2">
            {activo && permisos.promoverGuardian && !staff.es_guardian ? (
              <Button size="sm" variant="secondary" loading={accionando} onClick={onPromover}>
                Promover a Guardian
              </Button>
            ) : null}
            {permisos.revocarGuardian && staff.es_guardian ? (
              <Button size="sm" variant="secondary" loading={accionando} onClick={onRevocar}>
                Quitar perfil Guardian
              </Button>
            ) : null}
            {activo && permisos.suspenderStaff ? (
              <Button size="sm" variant="secondary" loading={accionando} onClick={onSuspender}>
                Suspender
              </Button>
            ) : null}
            {suspendido && permisos.reactivarStaff ? (
              <Button size="sm" variant="secondary" loading={accionando} onClick={onReactivar}>
                Reactivar
              </Button>
            ) : null}
            {permisos.retirarStaff ? (
              <Button size="sm" variant="danger" loading={accionando} onClick={onRetirar}>
                Eliminar acceso
              </Button>
            ) : null}
          </div>

          {activo && permisos.trasladarStaff && otrasSedes.length > 0 ? (
            <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
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
              <Button size="sm" variant="secondary" disabled={!destino} loading={accionando} onClick={onTrasladar}>
                Trasladar
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {suspendido ? (
        <Card className="mb-6 border-danger/30 bg-danger-soft">
          <p className="text-[12.5px] text-text-muted">
            Este Staff no puede acceder ni operar hasta que lo reactivés. Su historial y su
            Nivel se conservan intactos.
          </p>
        </Card>
      ) : null}

      {/* ── Historial (solo Barbería — RLS ya lo filtra igual) ───────────── */}
      {permisos.suspenderStaff ? (
        <section>
          <h2 className="font-display mb-3 text-[15px] font-bold uppercase text-text">Historial</h2>
          {historial.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
              Todavía no hay eventos registrados para este Staff.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historial.map((ev) => (
                <li key={ev.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
                  <p className="text-[13px] font-semibold text-text">
                    {ETIQUETA_ACCION[ev.accion] ?? ev.accion}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-faint">
                    {new Date(ev.createdAt).toLocaleString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {ev.motivo ? <p className="mt-1 text-[12px] text-text-muted">Motivo: {ev.motivo}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
