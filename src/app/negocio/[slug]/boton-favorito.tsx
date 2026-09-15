"use client";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { alternarFavorito } from "./actions";

export function BotonFavorito({ negocioId, slug, favoritoInicial }: { negocioId: string; slug: string; favoritoInicial: boolean }) {
  const router = useRouter();
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
      aria-label={favorito ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={favorito}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface transition-colors disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={favorito ? "#e8a23c" : "none"}
        stroke={favorito ? "#e8a23c" : "currentColor"}
        strokeWidth="1.8"
        className={cn("text-text-muted", favorito && "text-accent")}
      >
        <path d="M12 20.5s-7.5-4.6-10-9.3C.4 7.8 2 4.5 5.4 4a5 5 0 0 1 6.6 2.3A5 5 0 0 1 18.6 4c3.4.5 5 3.8 3.4 7.2-2.5 4.7-10 9.3-10 9.3z" />
      </svg>
    </button>
  );
}
