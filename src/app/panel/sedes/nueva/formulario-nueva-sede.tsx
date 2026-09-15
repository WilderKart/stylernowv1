"use client";

import { FormularioSede } from "@/components/negocio/formulario-sede";
import { useRouter } from "next/navigation";

export function FormularioNuevaSede({ negocioId }: { negocioId: string }) {
  const router = useRouter();

  return (
    <FormularioSede
      negocioId={negocioId}
      textoBoton="CREAR SEDE"
      onGuardado={(sede) => router.push(`/panel/sedes/${sede.id}`)}
    />
  );
}
