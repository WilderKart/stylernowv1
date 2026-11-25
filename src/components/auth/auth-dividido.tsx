"use client";

import { useT } from "@/lib/i18n/proveedor";
import type { CategoriaRegistro } from "@/lib/tema/vertical";
import Image from "next/image";
import Link from "next/link";
import { IMAGEN_MARCA_ACCESO } from "./imagen-marca";
import s from "./auth-dividido.module.css";

/** Se conserva por compatibilidad: el diseño ya no cambia según el tipo de cuenta, así que no hace nada. */
export function fijarAspectoActual() {}

/**
 * Armazón de las pantallas de acceso: a partir de tablet, panel azul de marca a la izquierda con un espacio para la imagen
 * y formulario a la derecha usando todo el ancho de la pantalla; en móvil, solo el formulario con cabecera de marca.
 * El tipo de negocio ya no cambia ni el aspecto ni la imagen.
 */
export function AuthDividido({ children }: { categoria?: CategoriaRegistro | null; viva?: boolean; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className={s.raiz}>
      <aside className={s.marcaPanel}>
        <Link href="/" className={s.logo}>
          StylerNow
        </Link>
        <div className={s.slot} role={IMAGEN_MARCA_ACCESO ? undefined : "img"} aria-label={IMAGEN_MARCA_ACCESO ? undefined : t("auth.imagen_marca")}>
          {IMAGEN_MARCA_ACCESO ? <Image src={IMAGEN_MARCA_ACCESO} alt="" fill sizes="50vw" priority className="object-cover" /> : <span>{t("auth.imagen_marca")}</span>}
        </div>
        <p className={s.lema}>{t("auth.lema_marca")}</p>
      </aside>
      <div className={s.formulario}>
        <div className={s.contenido}>{children}</div>
      </div>
    </div>
  );
}
