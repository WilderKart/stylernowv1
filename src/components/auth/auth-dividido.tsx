"use client";

import { useT } from "@/lib/i18n/proveedor";
import { TEMAS_POR_CATEGORIA_ACTIVOS, type CategoriaRegistro } from "@/lib/tema/vertical";
import Image from "next/image";
import { useEffect, useState } from "react";
import s from "./auth-dividido.module.css";

/** Deja el aspecto actual de la pantalla como definitivo para lo que sigue (p. ej. de «Crear cuenta» a «Verifica tu correo»). */
export function fijarAspectoActual() {
  document.documentElement.dataset.aspectoFijo = "1";
}

/** Imagen de cada categoría y de qué lado queda: se alternan para que cada cambio de categoría se vea como un giro. */
const FOTO: Record<CategoriaRegistro, { src: string | null; lado: "izq" | "der"; posicion?: string }> = {
  barberia: { src: "/img/auth/barberia.webp", lado: "izq" },
  tatuajes: { src: "/img/auth/tattoo.webp", lado: "der", posicion: "50% 8%" },
  salon: { src: "/img/auth/salon.webp", lado: "izq" },
  spa: { src: "/img/auth/spa.webp", lado: "der", posicion: "50% 50%" },
  manicura: { src: "/img/auth/unas.webp", lado: "izq", posicion: "30% 50%" },
};

/**
 * Armazón de las pantallas de acceso en escritorio: imagen del negocio a un lado y el formulario al otro. Cambiar la
 * categoría (barbería → tattoo → salón…) intercambia los lados con una transición y funde las imágenes. Solo es
 * presentación: la categoría nunca decide permisos. Con `viva`, el aspecto de TODA la pantalla (colores, fuentes) sigue
 * a la categoría en tiempo real.
 */
export function AuthDividido({ categoria, viva = false, children }: { categoria: CategoriaRegistro | null; viva?: boolean; children: React.ReactNode }) {
  const t = useT();
  const activa: CategoriaRegistro = categoria ?? "barberia";
  const [vistas, setVistas] = useState<CategoriaRegistro[]>([activa]);
  if (!vistas.includes(activa)) setVistas([...vistas, activa]);

  // Aspecto en vivo: pone el tema de la categoría en <html> mientras se elige y restaura el original al salir.
  useEffect(() => {
    if (!viva || !TEMAS_POR_CATEGORIA_ACTIVOS) return;
    const html = document.documentElement;
    delete html.dataset.aspectoFijo;
    const original = html.getAttribute("data-vertical");
    const v = { spa: "spa", salon: "salon", manicura: "unas" }[activa as string];
    if (categoria && v) html.setAttribute("data-vertical", v);
    else html.removeAttribute("data-vertical");
    return () => {
      // Tras crear la cuenta el aspecto elegido se conserva (verificación, onboarding): no se restaura el original.
      if (html.dataset.aspectoFijo === "1") return;
      if (original) html.setAttribute("data-vertical", original);
      else html.removeAttribute("data-vertical");
    };
  }, [viva, activa, categoria]);

  const sinTexto = activa === "barberia"; // la imagen de barbería ya trae su propio lema
  return (
    <div className={s.raiz} data-lado={FOTO[activa].lado}>
      <aside className={s.imagen} aria-hidden>
        {vistas.map((c) => {
          const f = FOTO[c];
          return (
            <div key={c} className={`${s.foto} ${f.src ? "" : s.spa}`} data-activa={c === activa}>
              {f.src ? <Image src={f.src} alt="" fill sizes="50vw" priority={c === activa} className="object-cover" style={{ objectPosition: f.posicion }} /> : <b>Beauty Spa</b>}
            </div>
          );
        })}
        <div className={s.velo} />
        <span className={s.marca} style={{ opacity: sinTexto ? 0 : 1 }}>
          StylerNow
        </span>
        <div className={s.pie} style={{ opacity: sinTexto ? 0 : 1 }}>
          <strong>{t(`auth.img_${activa}_t`)}</strong>
          <span>{t(`auth.img_${activa}_d`)}</span>
        </div>
      </aside>
      <div className={s.contenido}>{children}</div>
    </div>
  );
}
