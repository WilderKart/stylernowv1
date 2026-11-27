"use client";

import { abrirCanalAutenticado, nombreCanalUnico } from "@/lib/soporte/canal-autenticado";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Mantiene una pantalla del panel al día SIN recargar: apenas una reserva (o un pago directo) del negocio cambia, se vuelve a pedir
 * la información. Usa Realtime con la sesión del usuario (la RLS decide qué eventos le llegan; el contenido del evento NO se usa:
 * solo avisa «algo cambió» y los datos se piden de nuevo por las vías normales). Como red de seguridad, también se actualiza al
 * volver a la pestaña y cada 60 s mientras está visible.
 *
 * `alCambiar`: lo que se ejecuta al detectar un cambio. Por defecto, refrescar la página del servidor.
 */
export function ActualizarEnVivo({ negocioId, alCambiar }: { negocioId: string; alCambiar?: () => void }) {
  const router = useRouter();
  const callback = useRef<() => void>(() => router.refresh());
  // La referencia se actualiza fuera del render para que el canal siempre llame a la versión más reciente.
  useEffect(() => {
    callback.current = alCambiar ?? (() => router.refresh());
  });

  useEffect(() => {
    let temporizador: number | null = null;
    // Varios eventos seguidos (p. ej. reserva + pago) producen una sola actualización.
    const disparar = () => {
      if (temporizador !== null) window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        temporizador = null;
        if (document.visibilityState === "visible") callback.current();
      }, 700);
    };

    const supabase = createClient();
    const filtro = `negocio_id=eq.${negocioId}`;
    const cerrar = abrirCanalAutenticado(supabase, () =>
      supabase
        .channel(nombreCanalUnico("panel-en-vivo"))
        .on("postgres_changes", { event: "*", schema: "public", table: "reserva", filter: filtro }, disparar)
        .on("postgres_changes", { event: "*", schema: "public", table: "pago_reserva", filter: filtro }, disparar)
        .subscribe(),
    );

    const alVolver = () => {
      if (document.visibilityState === "visible") callback.current();
    };
    document.addEventListener("visibilitychange", alVolver);
    const intervalo = window.setInterval(alVolver, 60_000);

    return () => {
      if (temporizador !== null) window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
      window.clearInterval(intervalo);
      cerrar();
    };
  }, [negocioId]);

  return null;
}
