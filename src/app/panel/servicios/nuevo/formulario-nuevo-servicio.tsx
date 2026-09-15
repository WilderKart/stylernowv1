"use client";

import { FormularioServicio } from "@/components/negocio/formulario-servicio";
import { useRouter } from "next/navigation";

export function FormularioNuevoServicio({ negocioId }: { negocioId: string }) {
  const router = useRouter();
  return (
    <FormularioServicio
      negocioId={negocioId}
      puedeEditarPrecio
      textoBoton="CREAR SERVICIO"
      onGuardado={(id) => router.push(`/panel/servicios/${id}`)}
    />
  );
}
