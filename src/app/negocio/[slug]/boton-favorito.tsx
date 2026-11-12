"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/proveedor";
import { alternarFavorito } from "./actions";

export function BotonFavorito({ negocioId, slug, favoritoInicial }: { negocioId: string; slug: string; favoritoInicial: boolean }) {
  const router = useRouter();
  const t = useT();
  const [favorito, setFavorito] = useState(favoritoInicial);
  const [cargando, setCargando] = useState(false);

  async function onClick() {
    setCargando(true);
    const res = await alternarFavorito(negocioId, slug);
    setCargando(false);
    if (!res.ok) {
      router.push(`/login?next=/negocio/${slug}`);
      return;
    }
    setFavorito(res.data.favorito);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      aria-label={favorito ? t("neg.quitar_fav") : t("neg.guardar_fav")}
      aria-pressed={favorito}
      className="sn-fav disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill={favorito ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden="true"
      >
        <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />
      </svg>
    </button>
  );
}
