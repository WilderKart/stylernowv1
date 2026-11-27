"use client";

import { cerrarSesion } from "@/app/perfil/actions";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Botón único de «Cerrar sesión» para los paneles (negocio clásico, equipo/staff). Cierra la sesión en el servidor,
 * limpia la caché de la ruta y reemplaza el historial para que la pantalla privada no quede al volver atrás.
 */
export function BotonCerrarSesion({ className, conTexto = true, alSalir }: { className?: string; conTexto?: boolean; alSalir?: () => void }) {
  const router = useRouter();
  const [saliendo, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={saliendo}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      onClick={() =>
        iniciar(async () => {
          alSalir?.();
          await cerrarSesion();
          router.replace("/login");
          router.refresh();
        })
      }
      className={cn("flex min-h-11 items-center gap-2 disabled:opacity-50", className)}
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      {conTexto ? <span>{saliendo ? "Saliendo…" : "Cerrar sesión"}</span> : null}
    </button>
  );
}
