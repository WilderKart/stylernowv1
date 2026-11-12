"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { guardarEleccionCookies } from "./acciones-cookies";
import { useT } from "@/lib/i18n/proveedor";

const CLAVE = "stylernow_cookies_v1";

/**
 * Banner de cookies del diseño (Componentes2 · 11): bloque negro en ambos modos, ACEPTAR y
 * SOLO NECESARIAS con el mismo peso visual. No premarca nada: sin elección = solo necesarias.
 * Con sesión guarda la elección con guardarPrivacidad({ analitica }); siempre la recuerda en
 * localStorage (con try/catch) para no volver a mostrarse. NO se monta aquí: lo monta el orquestador.
 */
export function BannerCookies() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [, iniciar] = useTransition();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    iniciar(() => {
      try {
        if (!localStorage.getItem(CLAVE)) setVisible(true);
      } catch {
        // Sin almacenamiento (modo privado): se muestra en cada visita, sin romper nada.
        setVisible(true);
      }
    });
  }, [iniciar]);

  async function elegir(analitica: boolean) {
    setGuardando(true);
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ analitica, en: new Date().toISOString() }));
    } catch {
      /* no crítico */
    }
    try {
      await guardarEleccionCookies(analitica);
    } catch {
      /* sin sesión o sin red: queda en localStorage */
    }
    setGuardando(false);
    setVisible(false);
    window.dispatchEvent(new Event("stylernow:cookies")); // la analítica se activa o no según la elección
  }

  if (!visible) return null;

  const boton =
    "inline-flex min-h-12 items-center justify-center border-2 border-white px-3.5 font-mono text-xs leading-4 font-bold tracking-[0.72px] uppercase disabled:opacity-60";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-height)+8px)] z-40 mx-auto w-full max-w-xl px-3">
      <section
        role="region"
        aria-label={t("ck.aria")}
        className="pointer-events-auto flex flex-col gap-3 border-2 border-white bg-[#0a0a0a] p-4 text-white shadow-[4px_4px_0_0_var(--signal)]"
      >
        <span className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-signal">00 / COOKIES</span>
        <p className="body break-words">
          {t("ck.txt")}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled={guardando} onClick={() => elegir(true)} className={`${boton} bg-signal text-ink`}>
            {t("ck.aceptar")}
          </button>
          <button type="button" disabled={guardando} onClick={() => elegir(false)} className={`${boton} bg-transparent text-white`}>
            {t("ck.necesarias")}
          </button>
          <Link href="/privacidad" className="inline-flex min-h-12 items-center font-mono text-xs leading-4 font-bold tracking-[0.72px] text-white uppercase">
            {t("ck.ajustar")}
          </Link>
        </div>
      </section>
    </div>
  );
}
