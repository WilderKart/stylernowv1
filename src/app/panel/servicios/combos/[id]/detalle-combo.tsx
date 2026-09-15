"use client";

import { cambiarEstadoCombo } from "@/app/panel/servicios/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { FormularioCombo, type ServicioParaCombo } from "@/components/negocio/formulario-combo";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DetalleCombo({
  combo,
  servicios,
  servicioIdsIniciales,
  puedeGestionar,
}: {
  combo: {
    id: string;
    negocio_id: string;
    nombre: string;
    descripcion: string | null;
    precio_total_override: number | null;
    duracion_minutos_override: number | null;
    estado: "ACTIVO" | "INACTIVO";
  };
  servicios: ServicioParaCombo[];
  servicioIdsIniciales: string[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);

  const activo = combo.estado === "ACTIVO";

  async function onCambiarEstado() {
    setAccionando(true);
    setError(null);
    const res = await cambiarEstadoCombo(combo.id, !activo);
    setAccionando(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  if (!puedeGestionar) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-text">{combo.nombre}</p>
            <Badge tone={activo ? "success" : "neutral"}>{combo.estado}</Badge>
          </div>
          <p className="mt-2 text-[12.5px] text-text-muted">{combo.descripcion}</p>
          <p className="mt-3 text-[11.5px] text-text-faint">Solo la Barbería administra combos.</p>
        </Card>
      </main>
    );
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
          <Badge tone={activo ? "success" : "neutral"}>{combo.estado}</Badge>
        </div>
        <Button size="sm" variant="secondary" loading={accionando} onClick={onCambiarEstado} className="mt-3">
          {activo ? "Desactivar" : "Activar"}
        </Button>
      </Card>

      <section>
        <h2 className="font-display mb-3 text-[15px] font-bold uppercase text-text">Editar combo</h2>
        <FormularioCombo
          negocioId={combo.negocio_id}
          servicios={servicios}
          comboExistente={{ ...combo, servicioIdsIniciales }}
          textoBoton="GUARDAR CAMBIOS"
          onGuardado={() => router.refresh()}
        />
      </section>
    </main>
  );
}
