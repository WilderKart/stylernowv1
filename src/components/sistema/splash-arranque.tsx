"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/proveedor";

const CLAVE = "stylernow_splash_visto";
const DURACION_MS = 1600;

/**
 * Splash de arranque (C16): solo en la primera visita del navegador. `localStorage` puede estar
 * bloqueado (navegación privada): en ese caso no se muestra, para no repetirlo en cada carga.
 */
export function SplashArranque() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [, iniciar] = useTransition();

  useEffect(() => {
    let primera = false;
    try {
      if (!localStorage.getItem(CLAVE)) {
        localStorage.setItem(CLAVE, "1");
        primera = true;
      }
    } catch {
      /* sin almacenamiento: no hay splash */
    }
    if (!primera) return;
    iniciar(() => setVisible(true));
    const temporizador = window.setTimeout(() => setVisible(false), DURACION_MS);
    return () => window.clearTimeout(temporizador);
  }, [iniciar]);

  if (!visible) return null;

  const version = process.env.NEXT_PUBLIC_APP_VERSION;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="StylerNow"
      onClick={() => setVisible(false)}
      className="fixed inset-0 z-[100] flex flex-col justify-between overflow-hidden bg-ink text-paper"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="sn-num">01 /</span>
        <span className="sn-label">Barber culture</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <svg viewBox="0 0 200 200" role="img" aria-label="StylerNow" className="w-[min(220px,60vw)]">
          <defs>
            <path id="sn-sello" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
          </defs>
          <circle cx="100" cy="100" r="98" fill="#0A0A0A" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="100" cy="100" r="62" fill="none" stroke="#FF4D00" strokeWidth="2" />
          <g className="sn-splash-giro">
            <text fontFamily="var(--font-space-mono), monospace" fontSize="17" fontWeight="700" letterSpacing="5.6" fill="#FFFFFF">
              <textPath href="#sn-sello">STYLERNOW · BARBER CULTURE · </textPath>
            </text>
          </g>
          <text x="100" y="124" textAnchor="middle" fontFamily="var(--font-archivo), sans-serif" fontWeight="900" fontSize="72" fill="#FF4D00">
            S.
          </text>
        </svg>
        <p className="poster-3 text-center break-words">
          StylerNow<span className="sn-hot">.</span>
        </p>
      </div>

      <div className="overflow-hidden border-y-2 border-paper py-2 whitespace-nowrap" aria-hidden>
        <div className="sn-splash-marq inline-flex">
          {[0, 1].map((i) => (
            <span key={i} className="sn-label pr-6">
              {t("splash.marquee")}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span aria-label={t("splash.cargando")} role="status" className="flex gap-1.5">
          <span className="sn-splash-punto size-2.5 bg-signal" />
          <span className="sn-splash-punto size-2.5 bg-signal [animation-delay:.24s]" />
          <span className="sn-splash-punto size-2.5 bg-signal [animation-delay:.48s]" />
        </span>
        {version ? <span className="sn-meta text-paper">V{version}</span> : null}
      </div>

      <style>{`
        @keyframes sn-splash-giro{to{transform:rotate(360deg)}}
        @keyframes sn-splash-marq{to{transform:translateX(-50%)}}
        @keyframes sn-splash-punto{50%{opacity:.25}}
        .sn-splash-giro{transform-box:view-box;transform-origin:50% 50%;animation:sn-splash-giro 12s linear infinite}
        .sn-splash-marq{animation:sn-splash-marq 18s linear infinite}
        .sn-splash-punto{animation:sn-splash-punto .72s steps(1) infinite}
        @media (prefers-reduced-motion:reduce){.sn-splash-giro,.sn-splash-marq,.sn-splash-punto{animation:none}}
      `}</style>
    </div>
  );
}
