"use client";

import { useT } from "@/lib/i18n/proveedor";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Nombre del negocio con su insignia de verificación al lado. El mensaje informativo NO está siempre a la vista: aparece al tocar la
 * insignia y se esconde al tocarla de nuevo, al tocar fuera, con Escape o solo a los pocos segundos.
 */
export function TituloNegocioVerificado({ children, verificado }: { children: React.ReactNode; verificado: boolean }) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const [flecha, setFlecha] = useState(24);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idMensaje = useId();

  // Cierra al tocar fuera, con Escape y a los 6 s (el mensaje es un aviso corto, no un modal).
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    const temporizador = window.setTimeout(() => setAbierto(false), 6000);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  function alternar() {
    if (!abierto && boton.current && contenedor.current) {
      // La flecha del mensaje apunta al centro de la insignia, esté donde esté el nombre.
      const b = boton.current.getBoundingClientRect();
      const c = contenedor.current.getBoundingClientRect();
      setFlecha(Math.max(16, Math.min(b.left + b.width / 2 - c.left - 16, c.width - 48)));
    }
    setAbierto((v) => !v);
  }

  return (
    <div ref={contenedor} className="relative">
      <h1 className="poster-1 px-4 pb-3 break-words">
        {children}
        {verificado ? (
          <button
            ref={boton}
            type="button"
            onClick={alternar}
            aria-label={t("neg.verificado_aria")}
            aria-expanded={abierto}
            aria-describedby={abierto ? idMensaje : undefined}
            // Área táctil de 44 px sin alterar el tamaño visible de la insignia.
            className="relative ml-[0.14em] inline-block size-[0.5em] min-h-7 min-w-7 align-[0.12em] before:absolute before:-inset-2 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- icono propio de la plataforma */}
            <img src="/images/insignia-verificado.png" alt="" width={64} height={64} className="size-full" />
          </button>
        ) : null}
      </h1>
      {verificado && abierto ? (
        <div
          id={idMensaje}
          role="tooltip"
          className="absolute left-4 right-4 top-full z-20 -mt-1 max-w-[19rem] animate-in fade-in-0 duration-150 border-2 border-ink bg-ink px-3.5 py-3 text-[13.5px] leading-snug font-semibold text-paper shadow-hard-sm motion-reduce:animate-none"
        >
          <span aria-hidden className="absolute -top-[7px] size-3 rotate-45 border-l-2 border-t-2 border-ink bg-ink" style={{ left: flecha }} />
          {t("neg.verificado_info")}
        </div>
      ) : null}
    </div>
  );
}
