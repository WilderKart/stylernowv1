"use client";

import { suscribirPushAction } from "@/app/notificaciones/preferencias-actions";
import { enviarPushPruebaAction } from "@/app/notificaciones/push-prueba-actions";
import { BellRing, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Invita a activar los avisos del teléfono/computador (push) para enterarse de todo lo del negocio aunque la pantalla esté
 * bloqueada o la app cerrada. Se muestra en el panel y en SuperSU hasta que el dispositivo queda registrado.
 *
 *  - Pedir el permiso exige un toque de la persona (el navegador lo bloquea si no): por eso hay botón.
 *  - Si el permiso ya estaba dado, el dispositivo se registra solo y se vuelve a vincular a la cuenta actual (un teléfono
 *    compartido no debe seguir recibiendo los avisos de la persona anterior). Se repite como máximo cada 12 horas.
 *  - En iPhone/iPad los avisos solo existen con la app instalada en la pantalla de inicio: se explica cómo.
 */
type Estado = "cargando" | "oculto" | "pedir" | "ios_instalar" | "bloqueado" | "activo";

const CLAVE_DESCARTE = "sn_avisos_descartado";
const CLAVE_SINCRONIZADO = "sn_avisos_sincronizado";
const DESCARTE_MS = 3 * 24 * 3600 * 1000;
const SINCRONIA_MS = 12 * 3600 * 1000;

function leer(clave: string): number {
  try {
    return Number(localStorage.getItem(clave)) || 0;
  } catch {
    return 0;
  }
}
function guardar(clave: string, valor: number) {
  try {
    localStorage.setItem(clave, String(valor));
  } catch {
    /* sin almacenamiento: se vuelve a preguntar en la próxima visita */
  }
}

function claveAplicacion(base64Url: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const binario = atob((base64Url + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function registrar(sub: PushSubscription) {
  const json = sub.toJSON();
  return suscribirPushAction({ endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } });
}

export function ActivarAvisos({ vapidPublica }: { vapidPublica: string | null }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const poner = (e: Estado) => {
      if (vivo) setEstado(e);
    };
    void (async () => {
      if (!vapidPublica || typeof window === "undefined") return poner("oculto");
      const esIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const soportado = "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
      if (!soportado) return poner(esIos && !instalada ? "ios_instalar" : "oculto");
      if (Notification.permission === "denied") return poner(Date.now() - leer(CLAVE_DESCARTE) < DESCARTE_MS ? "oculto" : "bloqueado");
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (Notification.permission === "granted") {
          // Permiso ya dado: se registra (o se vincula de nuevo a esta cuenta) sin molestar a nadie.
          if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveAplicacion(vapidPublica) });
          if (Date.now() - leer(CLAVE_SINCRONIZADO) > SINCRONIA_MS) {
            const r = await registrar(sub);
            if (r.ok) guardar(CLAVE_SINCRONIZADO, Date.now());
          }
          return poner("activo");
        }
        poner(Date.now() - leer(CLAVE_DESCARTE) < DESCARTE_MS ? "oculto" : "pedir");
      } catch {
        poner("oculto");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [vapidPublica]);

  const activar = useCallback(async () => {
    if (!vapidPublica) return;
    setTrabajando(true);
    setMensaje(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "pedir");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveAplicacion(vapidPublica) }));
      const r = await registrar(sub);
      if (!r.ok) {
        setMensaje(r.error);
        return;
      }
      guardar(CLAVE_SINCRONIZADO, Date.now());
      setEstado("activo");
      setMensaje("¡Listo! Te enviamos una prueba para que compruebes que suena.");
      const prueba = await enviarPushPruebaAction();
      if (!prueba.ok) setMensaje(prueba.error);
    } catch {
      setMensaje("No pudimos activar los avisos en este dispositivo. Inténtalo de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }, [vapidPublica]);

  const descartar = () => {
    guardar(CLAVE_DESCARTE, Date.now());
    setEstado("oculto");
  };

  if (estado === "cargando" || estado === "oculto") return null;
  if (estado === "activo") {
    return mensaje ? (
      <div role="status" className="border-b border-border bg-surface px-4 py-2 text-[12.5px] text-text sm:px-8">
        {mensaje}
      </div>
    ) : null;
  }

  return (
    <div role="region" aria-label="Activar avisos" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-3 text-[13px] text-text sm:px-8">
      <BellRing className="size-5 shrink-0 text-accent" aria-hidden />
      <p className="m-0 min-w-0 flex-1 leading-snug">
        {estado === "pedir" ? (
          <>
            <b>Entérate al instante de todo lo de tu negocio.</b> Activa los avisos y te sonará el teléfono cuando llegue un mensaje de soporte, una reserva, un pago o un cambio, aunque la pantalla esté bloqueada.
          </>
        ) : estado === "ios_instalar" ? (
          <>
            <b>Para recibir avisos en iPhone,</b> instala la app: en Safari toca Compartir y luego «Agregar a pantalla de inicio». Ábrela desde ahí y activa los avisos.
          </>
        ) : (
          <>
            <b>Los avisos están bloqueados en este navegador.</b> Para activarlos, entra a los ajustes del sitio (el candado junto a la dirección) y permite las notificaciones.
          </>
        )}
        {mensaje ? <span className="mt-1 block text-danger">{mensaje}</span> : null}
      </p>
      {estado === "pedir" ? (
        <button type="button" onClick={() => void activar()} disabled={trabajando} className="min-h-11 rounded-full bg-accent px-5 text-[13px] font-bold text-white disabled:opacity-60">
          {trabajando ? "Activando…" : "Activar avisos"}
        </button>
      ) : null}
      <button type="button" onClick={descartar} aria-label="Ahora no" className="grid size-11 place-items-center rounded-full text-text-muted hover:bg-bg">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
