"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useSyncExternalStore } from "react";
import { crearTraductor, type Idioma } from "@/lib/i18n/diccionario";

/** Este boundary reemplaza el layout raíz (y su IdiomaProvider): el idioma se lee directo de la cookie. */
function idiomaDeCookie(): Idioma {
  return /(?:^|;\s*)sn_idioma=en(?:;|$)/.test(document.cookie) ? "en" : "es";
}
const sinSuscripcion = () => () => {};

/**
 * Reemplaza el layout raíz completo (incluido <html>/<body>) si el error
 * ocurre en el propio RootLayout — el único caso que error.tsx no cubre.
 * Deliberadamente sin depender de Tailwind ni de componentes de la app: si
 * algo ahí es lo que rompió, esta pantalla tiene que sobrevivir igual. Por eso
 * replica el sistema brutalista (esquinas 0, sombra dura, mono/condensado) con
 * estilos en línea y colores fijos del tema claro del prototipo.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const idioma = useSyncExternalStore(sinSuscripcion, idiomaDeCookie, () => "es" as Idioma);
  const t = crearTraductor(idioma);
  useEffect(() => {
    console.error("[global-error]", error);
    Sentry.captureException(error, { tags: { limite: "global-error" } });
  }, [error]);

  const mono = "'Space Mono', ui-monospace, Menlo, Consolas, monospace";
  return (
    <html lang={idioma}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#FFFFFF",
          color: "#0A0A0A",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <main
          style={{
            boxSizing: "border-box",
            width: "100%",
            maxWidth: 512,
            minHeight: "100dvh",
            margin: "0 auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <span style={{ font: `700 12px/16px ${mono}`, letterSpacing: 0.72, textTransform: "uppercase" }}>{t("err.codigo")}</span>
          <h1
            style={{
              margin: 0,
              fontFamily: "Archivo, Impact, 'Arial Narrow', sans-serif",
              fontStretch: "condensed",
              fontWeight: 900,
              fontSize: "clamp(36px, 13vw, 56px)",
              lineHeight: 0.9,
              textTransform: "uppercase",
              overflowWrap: "anywhere",
            }}
          >
            {t("err.global_1")}
            <br />
            {t("err.global_2")} <span style={{ background: "#FF4D00", padding: "0 4px" }}>{t("err.global_3")}</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: "22px", color: "#525252" }}>
            {t("err.global_txt")}
          </p>
          {error.digest ? (
            <span style={{ font: `400 11px/14px ${mono}`, letterSpacing: 0.66, textTransform: "uppercase", color: "#525252" }}>
              {t("err.codigo_n", { codigo: error.digest })}
            </span>
          ) : null}
          <button
            onClick={reset}
            style={{
              minHeight: 48,
              width: "100%",
              padding: "0 16px",
              border: "2px solid #0A0A0A",
              borderRadius: 0,
              background: "#FF4D00",
              color: "#0A0A0A",
              boxShadow: "4px 4px 0 0 #0A0A0A",
              font: `700 12px/16px ${mono}`,
              letterSpacing: 0.72,
              textTransform: "uppercase",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {t("comun.reintentar")}
          </button>
        </main>
      </body>
    </html>
  );
}
