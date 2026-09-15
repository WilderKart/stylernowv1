"use client";

import { useEffect } from "react";

/**
 * Reemplaza el layout raíz completo (incluido <html>/<body>) si el error
 * ocurre en el propio RootLayout — el único caso que error.tsx no cubre.
 * Deliberadamente sin depender de Tailwind ni de componentes de la app: si
 * algo ahí es lo que rompió, esta pantalla tiene que sobrevivir igual.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#0a0a0a",
          color: "#f5f1ea",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>StylerNow no pudo cargar</h1>
        <p style={{ fontSize: 14, color: "#9c9690", maxWidth: 320, margin: 0 }}>
          Algo falló al iniciar la aplicación. Reintentá — si persiste, contanos.
        </p>
        {error.digest ? (
          <p style={{ fontSize: 11, color: "#6b6862", fontFamily: "monospace" }}>
            Ref: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{
            background: "#e8a23c",
            color: "#0a0a0a",
            border: "none",
            borderRadius: 12,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          REINTENTAR
        </button>
      </body>
    </html>
  );
}
