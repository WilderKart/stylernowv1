"use client";

import { abrirCanalAutenticado, nombreCanalUnico } from "@/lib/soporte/canal-autenticado";
import { prepararAudio, reproducirAviso } from "@/lib/soporte/sonido";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

/**
 * Suena un tono cuando llega un mensaje de soporte del OTRO lado, estés en la pantalla que estés del panel (se monta en el
 * layout, no en el chat). No pinta nada. Es solo un aviso: qué mensajes llegan lo decide la base con RLS (la barbería solo
 * recibe los de su negocio; SuperSU, todos) y aquí además se descartan los propios.
 */
export function AlertaSonoraSoporte({ rol, negocioId }: { rol: "BARBERIA" | "SUPERSU"; negocioId?: string | null }) {
  useEffect(() => {
    // La barbería necesita su negocio para filtrar; SuperSU escucha todos.
    if (rol === "BARBERIA" && !negocioId) return;
    prepararAudio();
    const supabase = createClient();
    return abrirCanalAutenticado(supabase, () =>
      supabase
        .channel(nombreCanalUnico(`soporte-sonido-${rol}`))
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "soporte_mensaje", ...(rol === "BARBERIA" && negocioId ? { filter: `negocio_id=eq.${negocioId}` } : {}) },
          (p) => {
            const remitente = (p.new as { remitente_rol?: unknown } | null)?.remitente_rol;
            if ((remitente === "BARBERIA" || remitente === "SUPERSU") && remitente !== rol) reproducirAviso();
          },
        )
        .subscribe(),
    );
  }, [rol, negocioId]);
  return null;
}
