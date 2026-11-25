"use client";

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

/** Si no llegan señales nuevas, el indicador de la otra persona se apaga solo (p. ej. cerró la pestaña). */
const CADUCA_MS = 4500;
/** Mientras escribe, se avisa como máximo una vez cada tanto: el aviso es barato, pero no hace falta uno por tecla. */
const AVISO_CADA_MS = 2500;

type Rol = "BARBERIA" | "SUPERSU";

/**
 * Indicador «está escribiendo…» por Realtime Broadcast en un canal PRIVADO (`soporte-escritura:<negocio_id>`).
 * - Es efímero: no se guarda nada y la señal nunca lleva texto, solo `{ rol, activo }`.
 * - Quién puede entrar, escuchar o emitir lo decide la base (migración 197, política sobre realtime.messages);
 *   aquí el rol solo sirve para no mostrarte tu propio aviso.
 * - Va por su propio canal: no compite con la entrega de los mensajes (postgres_changes).
 *
 * `mensajesDelOtro` es cuántos mensajes de la otra persona hay en el hilo: el indicador se apaga solo cuando llega uno nuevo
 * (contar mensajes del otro, y no ids, evita que se apague cuando el mensaje propio pasa de temporal a real).
 */
export function useEscritura(negocioId: string | null | undefined, miRol: Rol, mensajesDelOtro: number) {
  // undefined = nadie escribe; número = mensajes de la otra persona que había cuando llegó la señal.
  const [senal, setSenal] = useState<number | undefined>(undefined);
  const canalRef = useRef<RealtimeChannel | null>(null);
  const listoRef = useRef(false);
  const ultimoAvisoRef = useRef(0);
  const caducaRef = useRef<number | undefined>(undefined);
  const marcaRef = useRef(mensajesDelOtro);

  useEffect(() => {
    marcaRef.current = mensajesDelOtro;
  }, [mensajesDelOtro]);

  useEffect(() => {
    if (!negocioId) return;
    const supabase = createClient();
    let cancelado = false;
    let canal: RealtimeChannel | null = null;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelado) return;
      // Un canal privado exige la sesión ya puesta antes de unirse.
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelado) return;
      canal = supabase
        .channel(`soporte-escritura:${negocioId}`, { config: { private: true, broadcast: { self: false } } })
        .on("broadcast", { event: "escribiendo" }, ({ payload }) => {
          const p = payload as { rol?: unknown; activo?: unknown } | null;
          if ((p?.rol !== "BARBERIA" && p?.rol !== "SUPERSU") || p.rol === miRol) return;
          window.clearTimeout(caducaRef.current);
          if (p.activo === false) {
            setSenal(undefined);
            return;
          }
          setSenal(marcaRef.current);
          caducaRef.current = window.setTimeout(() => setSenal(undefined), CADUCA_MS);
        })
        .subscribe((estado) => {
          listoRef.current = estado === "SUBSCRIBED";
        });
      canalRef.current = canal;
    })();
    return () => {
      cancelado = true;
      listoRef.current = false;
      window.clearTimeout(caducaRef.current);
      canalRef.current = null;
      if (canal) void supabase.removeChannel(canal);
    };
  }, [negocioId, miRol]);

  /** Avisa a la otra persona que empezaste (o dejaste) de escribir. Nunca envía el texto. */
  const avisar = useCallback(
    (activo: boolean) => {
      const canal = canalRef.current;
      if (!canal || !listoRef.current) return;
      const ahora = Date.now();
      if (activo) {
        if (ahora - ultimoAvisoRef.current < AVISO_CADA_MS) return;
        ultimoAvisoRef.current = ahora;
      } else {
        if (ultimoAvisoRef.current === 0) return;
        ultimoAvisoRef.current = 0;
      }
      void canal.send({ type: "broadcast", event: "escribiendo", payload: { rol: miRol, activo } });
    },
    [miRol],
  );

  // Visible solo mientras la señal sea de este momento del hilo: si llega un mensaje nuevo, se apaga sola.
  const otroEscribe = senal !== undefined && senal === mensajesDelOtro;
  return { otroEscribe, avisar };
}
