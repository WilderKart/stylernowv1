"use client";

import { activarPerfilProfesional, desactivarPerfilProfesional } from "@/app/panel/staff/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Perfil profesional del propietario (migración 160). El propietario administra; si además atiende clientes activa su propio perfil
 * (fila staff + vínculo, ocupa un cupo del plan) sin crear otra cuenta. La regla real (cupo, reservas futuras) la hace cumplir el
 * servidor: esta tarjeta solo informa y llama a las acciones.
 */
export function TarjetaPerfilProfesional({
  negocioId,
  prestaServicios,
  disponibles,
  limite,
  ocupados,
  planNombre,
  puedeActivar,
  puedeDesactivar,
}: {
  negocioId: string;
  prestaServicios: boolean;
  /** null = sin tope. */
  disponibles: number | null;
  limite: number | null;
  ocupados: number;
  planNombre: string;
  /** Configuración del plan (SuperSU): qué puede hacer el propietario con su perfil. */
  puedeActivar: boolean;
  puedeDesactivar: boolean;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinCupo = !prestaServicios && disponibles !== null && disponibles < 1;
  // Si el plan no permite activarlo, no hay tarjeta que ofrecer; si ya está activo y el plan no permite desactivarlo, solo se informa.
  if (!prestaServicios && !puedeActivar) return null;

  async function ejecutar(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setCargando(true);
    setError(null);
    const res = await fn(negocioId);
    setCargando(false);
    if (!res.ok) return setError(res.error ?? "No pudimos completar la acción.");
    router.refresh();
  }

  return (
    <Card className="mb-6 border-accent bg-app shadow-[4px_4px_0_0_var(--color-ink,#111)]">
      <p className="font-display text-[15px] font-bold uppercase text-text">
        {prestaServicios ? "Atiendes clientes" : "Activar mi perfil profesional"}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
        {prestaServicios
          ? `Tu perfil profesional está activo: tienes agenda propia y ocupas uno de los cupos de profesional de tu plan ${planNombre}${limite !== null ? ` (${ocupados} de ${limite} en uso)` : ""}.`
          : sinCupo
            ? `Hoy administras el negocio sin atender clientes. Para atender tú también necesitas un cupo de profesional y tu plan ${planNombre} ya tiene todos ocupados.`
            : `Hoy administras el negocio sin atender clientes. Si también atiendes, activa tu perfil profesional: tendrás tu propia agenda con la misma cuenta y ocuparás un cupo de profesional de tu plan ${planNombre}.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {prestaServicios ? (
          <>
            <Link href="/staff" className="bg-accent px-4 py-2.5 text-[12.5px] font-bold uppercase text-ink hover:bg-accent-hover">
              VER MI AGENDA
            </Link>
            {puedeDesactivar ? (
            <Button size="sm" variant="secondary" loading={cargando} onClick={() => ejecutar(desactivarPerfilProfesional)}>
              Dejar de atender
            </Button>
            ) : null}
          </>
        ) : sinCupo ? (
          <Link
            href="/panel/suscripcion"
            className="bg-accent px-4 py-2.5 text-[12.5px] font-bold uppercase text-ink hover:bg-accent-hover"
          >
            ACTUALIZAR MI PLAN
          </Link>
        ) : (
          <Button size="sm" loading={cargando} onClick={() => ejecutar(activarPerfilProfesional)}>
            ACTIVAR MI PERFIL PROFESIONAL
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
