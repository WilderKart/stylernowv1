"use client";

import { fijarSonido, prepararAudio, reproducirAviso, sonidoActivado, suscribirSonido } from "@/lib/soporte/sonido";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import s from "./chat-3d.module.css";

/** Activa o silencia el aviso sonoro de mensajes nuevos (se guarda en este dispositivo). */
export function BotonSonido() {
  const activado = useSyncExternalStore(suscribirSonido, sonidoActivado, () => true);
  useEffect(() => {
    prepararAudio();
  }, []);
  return (
    <button
      type="button"
      className={s.boton}
      style={{ width: 40, height: 40, flex: "none" }}
      aria-pressed={activado}
      aria-label={activado ? "Silenciar el sonido de mensajes nuevos" : "Activar el sonido de mensajes nuevos"}
      title={activado ? "Sonido activado" : "Sonido silenciado"}
      onClick={() => {
        fijarSonido(!activado);
        // Al activarlo suena una vez para que la persona oiga cómo es (también desbloquea el audio del navegador).
        if (!activado) reproducirAviso(true);
      }}
    >
      {activado ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
    </button>
  );
}
