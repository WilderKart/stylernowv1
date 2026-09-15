"use client";

import { FormularioCombo, type ServicioParaCombo } from "@/components/negocio/formulario-combo";
import { useRouter } from "next/navigation";

export function FormularioNuevoCombo({
  negocioId,
  servicios,
}: {
  negocioId: string;
  servicios: ServicioParaCombo[];
}) {
  const router = useRouter();
  return (
    <FormularioCombo
      negocioId={negocioId}
      servicios={servicios}
      textoBoton="CREAR COMBO"
      onGuardado={(id) => router.push(`/panel/servicios/combos/${id}`)}
    />
  );
}
