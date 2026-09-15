"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState, useTransition } from "react";

const CLAVE_VISITAS = "stylernow_visitas";
const CLAVE_DESCARTADO = "stylernow_pwa_descartado_hasta";
const VISITAS_MINIMAS = 2; // 02-UX/03_Client_PWA.md: nunca en la primera visita

type EventoInstalacion = Event & { prompt: () => Promise<void> };

function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function yaInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error -- API no estándar de Safari/iOS
    window.navigator.standalone === true
  );
}

/**
 * Registro del Service Worker + prompt de instalación de la PWA
 * (02-UX/03_Client_PWA.md). Se monta una vez en el layout raíz.
 */
export function PwaManager() {
  const [eventoDiferido, setEventoDiferido] = useState<EventoInstalacion | null>(null);
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [esIosDetectado, setEsIosDetectado] = useState(false);
  const [, iniciarDeteccion] = useTransition();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No bloquea la app: sin SW simplemente no hay cacheo de shell ni
        // instalación, la funcionalidad transaccional sigue intacta.
      });
    }

    let visitas = 0;
    try {
      visitas = Number(localStorage.getItem(CLAVE_VISITAS) ?? "0") + 1;
      localStorage.setItem(CLAVE_VISITAS, String(visitas));
    } catch {
      /* localStorage bloqueado (navegación privada) — sin prompt, no rompe nada */
    }

    const descartadoHasta = Number(
      (() => {
        try {
          return localStorage.getItem(CLAVE_DESCARTADO) ?? "0";
        } catch {
          return "0";
        }
      })()
    );

    const puedeMostrar =
      visitas >= VISITAS_MINIMAS && Date.now() > descartadoHasta && !yaInstalada();

    if (!puedeMostrar) return;

    if (esIOS()) {
      // iOS Safari no dispara beforeinstallprompt: no hay API de instalación
      // programática, solo se puede guiar al usuario al paso manual.
      iniciarDeteccion(() => {
        setEsIosDetectado(true);
        setMostrarBanner(true);
      });
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setEventoDiferido(e as EventoInstalacion);
      setMostrarBanner(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [iniciarDeteccion]);

  function descartar(dias = 14) {
    setMostrarBanner(false);
    try {
      localStorage.setItem(CLAVE_DESCARTADO, String(Date.now() + dias * 86_400_000));
    } catch {
      /* no crítico */
    }
  }

  async function instalar() {
    if (!eventoDiferido) return;
    await eventoDiferido.prompt();
    setEventoDiferido(null);
    setMostrarBanner(false);
  }

  if (!mostrarBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="#e8a23c"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v13m0 0-4-4m4 4 4-4M5 20h14" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-text">Instalá StylerNow</p>
          <p className="truncate text-[11.5px] text-text-faint">
            {esIosDetectado
              ? "Tocá Compartir y luego “Agregar a inicio”"
              : "Acceso directo, sin ocupar espacio de más"}
          </p>
        </div>
        {esIosDetectado ? (
          <Button size="sm" variant="secondary" onClick={() => descartar()}>
            Entendido
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => descartar()}>
              Ahora no
            </Button>
            <Button size="sm" onClick={instalar}>
              Instalar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
