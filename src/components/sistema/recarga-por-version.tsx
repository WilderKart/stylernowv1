"use client";

import { useEffect } from "react";

/**
 * Versión desfasada tras un despliegue (Sentry: «Server Action "…" was not found on the server»).
 *
 * Quien tenía la app abierta cuando publicamos una versión nueva conserva el JavaScript viejo; al
 * usar un formulario o botón, ese código llama a una Server Action cuyo identificador ya no existe
 * y la acción falla. Vercel lo evita con «Skew Protection», pero solo en los planes Pro y Enterprise.
 *
 * Aquí: si aparece ese error, la página se recarga UNA vez (marca en sessionStorage durante 60 s,
 * para no entrar en bucle si el error fuera otra cosa) y la persona sigue con la versión nueva.
 */
const PATRON = /Server Action ".+" was not found|UnrecognizedActionError|Failed to find Server Action/i;
const MARCA = "stylernow_recarga_version";

function intentarRecarga(motivo: unknown) {
  const texto = motivo instanceof Error ? `${motivo.name} ${motivo.message}` : String(motivo ?? "");
  if (!PATRON.test(texto)) return;
  try {
    const ultima = Number(sessionStorage.getItem(MARCA) ?? 0);
    if (Date.now() - ultima < 60_000) return;
    sessionStorage.setItem(MARCA, String(Date.now()));
  } catch {
    /* sin sessionStorage: se recarga igual una vez por carga de página */
  }
  window.location.reload();
}

export function RecargaPorVersion() {
  useEffect(() => {
    const porPromesa = (e: PromiseRejectionEvent) => intentarRecarga(e.reason);
    const porError = (e: ErrorEvent) => intentarRecarga(e.error ?? e.message);
    window.addEventListener("unhandledrejection", porPromesa);
    window.addEventListener("error", porError);
    return () => {
      window.removeEventListener("unhandledrejection", porPromesa);
      window.removeEventListener("error", porError);
    };
  }, []);
  return null;
}
