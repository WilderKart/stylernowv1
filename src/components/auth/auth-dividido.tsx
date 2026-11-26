"use client";

import { useT } from "@/lib/i18n/proveedor";
import type { CategoriaRegistro } from "@/lib/tema/vertical";
import Image from "next/image";
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
 * Armazón de las pantallas de acceso en escritorio: imagen de StylerNow a un lado y el formulario al otro. Identidad
 * única (decisión 2026-11-25): la imagen, el lado y los colores son siempre los originales de StylerNow y no cambian
 * según el tipo de negocio ni de cuenta (sin temas, transiciones ni efectos por categoría).
 */
export function AuthDividido({ children }: { categoria?: CategoriaRegistro | null; viva?: boolean; children: React.ReactNode }) {
  const t = useT();
  const activa: CategoriaRegistro = "barberia";
  const vistas: CategoriaRegistro[] = [activa];

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
