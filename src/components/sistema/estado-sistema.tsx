"use client";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { consultarEstadoSistemaAction } from "./actions";

/** Rutas que nunca se redirigen: el propio aviso, el acceso (incluido el de SuperSU), el panel de SuperSU y la legal. */
const EXENTAS = ["/mantenimiento", "/login", "/auth", "/admin", "/api", "/legal"];
const REVISAR_CADA_MS = 60_000;

function exenta(ruta: string) {
  return EXENTAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));
}

/** Compara "1.4.0" con "1.10.2". Devuelve <0 si a es menor que b. Versiones no numéricas se ignoran (0). */
function compararVersion(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Estado del sistema (C16): redirige a /mantenimiento cuando el servidor lo indica y avisa de una
 * versión nueva (por versión mínima o porque el service worker tomó el control con código nuevo).
 * Es una sola RPC por carga y se repite como máximo cada 60 s al volver a la pestaña.
 */
export function EstadoSistema() {
  const ruta = usePathname();
  const router = useRouter();
  const rutaRef = useRef(ruta);
  const [hayVersion, setHayVersion] = useState(false);
  const [descartado, setDescartado] = useState(false);
  const [, iniciar] = useTransition();

  useEffect(() => {
    rutaRef.current = ruta;
  }, [ruta]);

  useEffect(() => {
    let ultima = 0;
    let vivo = true;
    const miVersion = process.env.NEXT_PUBLIC_APP_VERSION;

    async function revisar() {
      if (Date.now() - ultima < REVISAR_CADA_MS) return;
      ultima = Date.now();
      try {
        const e = await consultarEstadoSistemaAction();
        if (!vivo) return;
        if (e.mantenimiento && !exenta(rutaRef.current)) {
          router.replace("/mantenimiento");
          return;
        }
        if (miVersion && e.versionMinima && compararVersion(miVersion, e.versionMinima) < 0) {
          iniciar(() => setHayVersion(true));
        }
      } catch {
        /* sin red o servidor caído: no se bloquea la app */
      }
    }

    function alVolver() {
      if (document.visibilityState === "visible") void revisar();
    }

    void revisar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", revisar);

    // Código nuevo: si ya había un SW controlando y toma el control otro, hay versión nueva.
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    const habiaControlador = Boolean(sw?.controller);
    const alCambiar = () => {
      if (habiaControlador) iniciar(() => setHayVersion(true));
    };
    sw?.addEventListener("controllerchange", alCambiar);

    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", revisar);
      sw?.removeEventListener("controllerchange", alCambiar);
    };
  }, [router, iniciar]);

  if (!hayVersion || descartado || ruta === "/mantenimiento") return null;

  return (
    <div
      role="alertdialog"
      aria-labelledby="sn-nueva-version"
      className="fixed inset-x-0 bottom-0 z-[80] border-t-2 border-ink bg-paper px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink"
    >
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <span className="sn-num">02 / Actualización</span>
        <h2 id="sn-nueva-version" className="poster-4">
          Nueva versión<span className="sn-hot">.</span>
        </h2>
        <p className="body-sm">Hay mejoras listas. Actualiza para seguir reservando sin problemas.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="min-w-[8rem] flex-1 text-ink" onClick={() => setDescartado(true)}>
            Más tarde
          </Button>
          <Button className="min-w-[8rem] flex-1" onClick={() => window.location.reload()}>
            Actualizar <span aria-hidden>↗</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
