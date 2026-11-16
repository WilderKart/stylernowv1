"use client";

import * as React from "react";

/**
 * Widget de Cloudflare Turnstile (modo «Managed»: casi siempre invisible para una persona real).
 * Solo produce un token; la verificación ocurre en el servidor (src/lib/seguridad/turnstile.ts).
 * La clave del sitio es pública. El script se inserta desde nuestro propio código, así que la CSP
 * con nonce + 'strict-dynamic' lo admite; el iframe necesita frame-src challenges.cloudflare.com.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAGCzDAELLIFp3KIM";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type ApiTurnstile = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

let cargando: Promise<ApiTurnstile> | null = null;
function cargarApi(): Promise<ApiTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (cargando) return cargando;
  cargando = new Promise((resolver, rechazar) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolver(window.turnstile) : rechazar(new Error("turnstile")));
    s.onerror = () => {
      cargando = null;
      rechazar(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

export type ControlTurnstile = { reiniciar: () => void };

/** Devuelve el token vigente (o null) y un control para pedir uno nuevo tras cada envío. */
export const Turnstile = React.forwardRef<ControlTurnstile, { accion: "registro" | "ingreso" | "recuperar"; onToken: (t: string | null) => void }>(
  function Turnstile({ accion, onToken }, ref) {
    const caja = React.useRef<HTMLDivElement>(null);
    const id = React.useRef<string | null>(null);
    const alToken = React.useRef(onToken);
    React.useEffect(() => {
      alToken.current = onToken;
    }, [onToken]);

    React.useImperativeHandle(ref, () => ({
      reiniciar: () => {
        alToken.current(null);
        if (id.current && window.turnstile) window.turnstile.reset(id.current);
      },
    }));

    React.useEffect(() => {
      let vivo = true;
      cargarApi()
        .then((api) => {
          if (!vivo || !caja.current || id.current) return;
          id.current = api.render(caja.current, {
            sitekey: SITE_KEY,
            action: accion,
            theme: "auto",
            language: "es",
            size: "flexible",
            callback: (t: string) => alToken.current(t),
            "expired-callback": () => alToken.current(null),
            "error-callback": () => alToken.current(null),
          });
        })
        .catch(() => alToken.current(null));
      return () => {
        vivo = false;
        if (id.current && window.turnstile) window.turnstile.remove(id.current);
        id.current = null;
      };
    }, [accion]);

    return <div ref={caja} className="min-h-[65px] w-full" />;
  }
);
