"use client";

import { alternarStaffServicio, cambiarEstadoServicio, definirServicioSede, type StaffAsignable } from "@/app/panel/servicios/actions";
import { ImagenServicio } from "@/components/servicios/imagen-servicio";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { FormularioServicio, type ServicioExistente } from "@/components/negocio/formulario-servicio";
import type { PermisosPanel } from "@/lib/auth/resolver-contexto";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DetalleServicio({
  servicio,
  permisos,
  staffAsignableInicial,
  sedes: sedesIniciales,
  sedePropiaId,
}: {
  servicio: ServicioExistente & { negocio_id: string; estado: "ACTIVO" | "INACTIVO" };
  permisos: PermisosPanel;
  staffAsignableInicial: StaffAsignable[];
  sedes: Array<{ id: string; nombre: string; ofrece: boolean }>;
  /** Si quien mira es guardián, solo puede cambiar SU sede (la base lo exige igual). */
  sedePropiaId: string | null;
}) {
  const [sedes, setSedes] = useState(sedesIniciales);
  const router = useRouter();
  const [staffAsignable, setStaffAsignable] = useState(staffAsignableInicial);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);

  const activo = servicio.estado === "ACTIVO";

  async function onCambiarEstado() {
    setAccionando(true);
    setError(null);
    const res = await cambiarEstadoServicio(servicio.id, !activo);
    setAccionando(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  async function onAlternarSede(sedeId: string, ofrece: boolean) {
    const anterior = sedes;
    setSedes((prev) => prev.map((s) => (s.id === sedeId ? { ...s, ofrece } : s)));
    const res = await definirServicioSede(servicio.id, sedeId, ofrece);
    if (!res.ok) {
      setSedes(anterior);
      setError(res.error);
    } else setError(null);
  }

  async function onAlternarStaff(staffId: string, asignarAhora: boolean) {
    const anterior = staffAsignable;
    setStaffAsignable((prev) => prev.map((s) => (s.staffId === staffId ? { ...s, asignado: asignarAhora } : s)));
    const res = await alternarStaffServicio(servicio.id, staffId, asignarAhora);
    if (!res.ok) {
      setStaffAsignable(anterior);
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

      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <ImagenServicio url={servicio.imagen_url} nombre={servicio.nombre} className="size-20" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-text">Estado</p>
              <Badge tone={activo ? "success" : "neutral"}>{activo ? "Se ofrece" : "No se ofrece"}</Badge>
            </div>
            {permisos.activarDesactivarServicio ? (
              <>
                <Button size="sm" variant="secondary" loading={accionando} onClick={onCambiarEstado} className="mt-3">
                  {activo ? "Dejar de ofrecer" : "Volver a ofrecer"}
                </Button>
                <p className="mt-2 text-[11.5px] text-text-faint">
                  Los servicios no se borran: si ya no lo prestas, déjalo de ofrecer y deja de aparecer a tus clientes. Tus reservas y tu historial se conservan, y puedes reactivarlo cuando quieras.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </Card>

      {sedes.length > 0 ? (
        <section className="mb-6">
          <h2 className="font-display mb-1 text-[15px] font-bold uppercase text-text">Sedes donde se ofrece</h2>
          <p className="mb-3 text-[12px] text-text-muted">Activa o desactiva este servicio en cada sede. En una sede desactivada no se puede reservar.</p>
          <ul className="flex flex-col gap-2">
            {sedes.map((s) => {
              const puede = permisos.activarDesactivarServicio && (sedePropiaId === null || sedePropiaId === s.id);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 border-2 border-border bg-surface p-3">
                  <p className="truncate text-[13px] font-semibold text-text">{s.nombre}</p>
                  <button
                    type="button"
                    disabled={!puede}
                    aria-pressed={s.ofrece}
                    onClick={() => onAlternarSede(s.id, !s.ofrece)}
                    className={`min-h-9 shrink-0 border-2 px-3 text-[11.5px] font-bold uppercase disabled:opacity-50 ${s.ofrece ? "border-ink bg-signal text-ink" : "border-border text-text-muted"}`}
                  >
                    {s.ofrece ? "Se ofrece" : "No se ofrece"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {permisos.asignarStaffServicio ? (
        <section className="mb-6">
          <h2 className="font-display mb-3 text-[15px] font-bold uppercase text-text">Staff asignado</h2>
          {activo && !staffAsignable.some((s) => s.asignado) ? (
            <Card className="mb-3 border-danger/30 bg-danger-soft">
              <p className="text-[12.5px] font-semibold text-danger">
                Nadie puede ser reservado para este servicio todavía
              </p>
              <p className="mt-1 text-[12px] text-text-muted">
                El motor de reservas exige que al menos un Staff esté asignado explícitamente —
                asigna a alguien de la lista de abajo para que el servicio sea reservable.
              </p>
            </Card>
          ) : null}
          {staffAsignable.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
              Todavía no tienes Staff activo para asignar a este servicio.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {staffAsignable.map((s) => (
                <li
                  key={s.staffId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5"
                >
                  <p className="truncate text-[13px] font-semibold text-text">{s.nombre}</p>
                  <button
                    type="button"
                    onClick={() => onAlternarStaff(s.staffId, !s.asignado)}
                    className={`shrink-0 rounded-none px-3 py-1.5 text-[11.5px] font-bold ${
                      s.asignado ? "bg-accent-soft text-accent" : "border border-border text-text-muted"
                    }`}
                  >
                    {s.asignado ? "Asignado" : "Asignar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="font-display mb-3 text-[15px] font-bold uppercase text-text">Editar servicio</h2>
        <FormularioServicio
          negocioId={servicio.negocio_id}
          servicioExistente={servicio}
          puedeEditarPrecio={permisos.cambiarPrecioServicio}
          textoBoton="GUARDAR CAMBIOS"
          onGuardado={() => {
            // Tras guardar, se vuelve al listado de servicios (ahí se ve el cambio).
            router.push("/panel/servicios");
            router.refresh();
          }}
        />
      </section>
    </main>
  );
}
