"use client";

import { abrirCanalAutenticado, nombreCanalUnico } from "@/lib/soporte/canal-autenticado";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { contarNoLeidosSoporte } from "@/app/panel/soporte/chat-actions";

export function SoporteNavBadge() {
  const [cantidad, setCantidad] = useState(0);

  useEffect(() => {
    let activo = true;
    const actualizar = async () => {
      const n = await contarNoLeidosSoporte();
      if (activo) setCantidad(n);
    };
    void actualizar();

    const supabase = createClient();
    const cerrar = abrirCanalAutenticado(supabase, () =>
      supabase
        .channel(nombreCanalUnico("soporte-badge-panel"))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "soporte_mensaje" }, () => {
          void actualizar();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "soporte_conversacion" }, () => {
          void actualizar();
        })
        .subscribe(),
    );

    return () => {
      activo = false;
      cerrar();
    };
  }, []);

  if (cantidad <= 0) return null;
  return (
    <span
      className="ml-auto min-w-5 rounded-none bg-[var(--side-accent)] px-1.5 py-0.5 text-center font-mono text-[10px] font-bold text-[var(--side-bg)]"
      aria-label={`${cantidad} mensajes sin leer`}
    >
      {cantidad > 99 ? "99+" : cantidad}
    </span>
  );
}
