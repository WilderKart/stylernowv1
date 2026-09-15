"use client";

import { alternarStaffServicio, cambiarEstadoServicio, type StaffAsignable } from "@/app/panel/servicios/actions";
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
}: {
  servicio: ServicioExistente & { negocio_id: string; estado: "ACTIVO" | "INACTIVO" };
  permisos: PermisosPanel;
  staffAsignableInicial: StaffAsignable[];
}) {
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
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold text-text">Estado</p>
          <Badge tone={activo ? "success" : "neutral"}>{servicio.estado}</Badge>
        </div>
        {permisos.activarDesactivarServicio ? (
          <Button size="sm" variant="secondary" loading={accionando} onClick={onCambiarEstado} className="mt-3">
            {activo ? "Desactivar" : "Activar"}
          </Button>
        ) : null}
      </Card>

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
                asigná a alguien de la lista de abajo para que el servicio sea reservable.
              </p>
            </Card>
          ) : null}
          {staffAsignable.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
              Todavía no tenés Staff activo para asignar a este servicio.
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
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold ${
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
          onGuardado={() => router.refresh()}
        />
      </section>
    </main>
  );
}
