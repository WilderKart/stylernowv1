"use client";

import { COOKIE_TEMA, COOKIE_TEMA_SISTEMA, type ModoTema, type TemaEfectivo } from "@/lib/tema/preferencia";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const UN_ANO = 60 * 60 * 24 * 365;

function escribirCookie(nombre: string, valor: string) {
  try {
    document.cookie = `${nombre}=${valor}; path=/; max-age=${UN_ANO}; samesite=lax`;
  } catch {
    /* sin cookies: el cambio vale solo para esta visita */
  }
}

function leerCookie(nombre: string): string | undefined {
  try {
    return document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${nombre}=`))
      ?.split("=")[1];
  } catch {
    return undefined;
  }
}

const sistemaPrefiereOscuro = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

function aplicar(tema: TemaEfectivo) {
  document.documentElement.setAttribute("data-theme", tema);
}

/** Resuelve el tema real de un modo y lo aplica al instante. */
function aplicarModo(modo: ModoTema) {
  const efectivo: TemaEfectivo = modo === "auto" ? (sistemaPrefiereOscuro() ? "dark" : "light") : modo;
  aplicar(efectivo);
  if (modo === "auto") escribirCookie(COOKIE_TEMA_SISTEMA, efectivo);
}

/**
 * Mantiene el tema al día cuando la persona eligió «automático»: sigue al dispositivo y recuerda su preferencia
 * para que la próxima visita llegue ya con el tema correcto desde el servidor.
 */
export function SincronizarTema({ modoInicial }: { modoInicial: ModoTema }) {
  useEffect(() => {
    const modo = (leerCookie(COOKIE_TEMA) as ModoTema | undefined) ?? modoInicial;
    if (modo !== "auto") return;
    aplicarModo("auto");
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => aplicarModo("auto");
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, [modoInicial]);
  return null;
}

// El tema real vive en <html data-theme>; el botón lo lee de ahí (así refleja también el modo automático).
function suscribirTema(avisar: () => void) {
  const obs = new MutationObserver(avisar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const temaActualOscuro = () => document.documentElement.getAttribute("data-theme") === "dark";

/** Botón compacto (sol/luna) para las barras: alterna claro ↔ oscuro y recuerda la elección. */
export function BotonTema({ className }: { className?: string }) {
  const oscuro = useSyncExternalStore(suscribirTema, temaActualOscuro, () => false);

  function alternar() {
    const siguiente: TemaEfectivo = oscuro ? "light" : "dark";
    escribirCookie(COOKIE_TEMA, siguiente);
    aplicarModo(siguiente);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={oscuro}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      className={className ?? "sn-iconbtn"}
    >
      {oscuro ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
    </button>
  );
}

/** Selector completo (Claro / Oscuro / Automático) para Ajustes. */
export function SelectorTema({ modoInicial }: { modoInicial: ModoTema }) {
  const [modo, setModo] = useState<ModoTema>(modoInicial);

  function elegir(m: ModoTema) {
    setModo(m);
    escribirCookie(COOKIE_TEMA, m);
    aplicarModo(m);
  }

  const opciones: { valor: ModoTema; etiqueta: string; Icono: typeof Sun }[] = [
    { valor: "light", etiqueta: "Claro", Icono: Sun },
    { valor: "dark", etiqueta: "Oscuro", Icono: Moon },
    { valor: "auto", etiqueta: "Automático", Icono: Monitor },
  ];

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sn-label mb-1">Apariencia</legend>
      <div role="radiogroup" aria-label="Apariencia" className="grid grid-cols-3 gap-2">
        {opciones.map(({ valor, etiqueta, Icono }) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={modo === valor}
            onClick={() => elegir(valor)}
            className={`flex min-h-16 flex-col items-center justify-center gap-1.5 border-2 border-border px-2 py-3 text-[13px] font-bold ${
              modo === valor ? "bg-signal text-ink" : "bg-bg text-text"
            }`}
          >
            <Icono aria-hidden className="size-5" />
            {etiqueta}
          </button>
        ))}
      </div>
      <p className="text-[12.5px] leading-relaxed text-text-muted">
        «Automático» sigue la configuración de tu dispositivo. Tu elección se recuerda en este navegador.
      </p>
    </fieldset>
  );
}
