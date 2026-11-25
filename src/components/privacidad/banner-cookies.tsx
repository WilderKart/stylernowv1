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
    "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-60";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-height)+24px)] z-40 mx-auto w-full max-w-xl px-3 lg:bottom-6 lg:left-6 lg:right-auto lg:mx-0 lg:max-w-md">
      <section
        role="region"
        aria-label={t("ck.aria")}
        className="pointer-events-auto flex flex-col gap-3 rounded-3xl border border-border bg-bg p-5 text-text shadow-[var(--sn-shadow-hard)]"
      >
        <span className="text-xs font-semibold text-accent-text">Cookies</span>
        <p className="body break-words">
          {t("ck.txt")}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled={guardando} onClick={() => elegir(true)} className={`${boton} bg-signal text-white`}>
            {t("ck.aceptar")}
          </button>
          <button type="button" disabled={guardando} onClick={() => elegir(false)} className={`${boton} border border-border bg-bg text-text`}>
            {t("ck.necesarias")}
          </button>
          <Link href="/privacidad" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text">
            {t("ck.ajustar")}
          </Link>
        </div>
      </section>
    </div>
  );
}
