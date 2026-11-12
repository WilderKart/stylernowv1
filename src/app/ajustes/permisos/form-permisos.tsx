"use client";

import { ErrorAviso, Pie, Top } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import type { EstadoPermiso } from "@/lib/cliente/preferencias";
import { useEnLinea } from "@/lib/hooks/use-en-linea";
import { cn } from "@/lib/utils";
import { Bell, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarPermisosAction } from "../actions";
import { useT } from "@/lib/i18n/proveedor";

type Clave = "ubicacion" | "notificaciones";

const DEFS = [
  {
    clave: "ubicacion",
    titulo: "perm.ubicacion",
    porque: "perm.ubicacion_porque",
    icono: MapPin,
  },
  {
    clave: "notificaciones",
    titulo: "perm.notificaciones",
    porque: "perm.notificaciones_porque",
    icono: Bell,
  },
] as const;

/** Pide el permiso real al navegador. Devuelve "granted" | "denied" | "unsupported". */
async function pedirUbicacion(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "unsupported";
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      () => resolve("denied"),
      { timeout: 15_000, maximumAge: 600_000 },
    );
  });
}

async function pedirNotificaciones(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    const r = await Notification.requestPermission();
    return r === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export function FormPermisos({
  ubicacionInicial,
  notificacionesInicial,
  enOnboarding,
}: {
  ubicacionInicial: EstadoPermiso | null;
  notificacionesInicial: EstadoPermiso | null;
  enOnboarding: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const enLinea = useEnLinea();
  const [estado, setEstado] = useState<Record<Clave, EstadoPermiso | null>>({
    ubicacion: ubicacionInicial,
    notificaciones: notificacionesInicial,
  });
  // Cuando el navegador/SO bloqueó el permiso hay que decirle al usuario cómo reactivarlo.
  const [bloqueado, setBloqueado] = useState<Record<Clave, boolean>>({ ubicacion: false, notificaciones: false });
  const [ocupado, setOcupado] = useState<Clave | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  async function persistir(clave: Clave, valor: EstadoPermiso) {
    const r = await guardarPermisosAction(
      clave === "ubicacion" ? valor : null,
      clave === "notificaciones" ? valor : null,
      false,
    );
    if (!r.ok) setError(r.error);
    return r.ok;
  }

  async function permitir(clave: Clave) {
    setError(null);
    setOcupado(clave);
    const res = clave === "ubicacion" ? await pedirUbicacion() : await pedirNotificaciones();
    if (res === "granted") {
      setBloqueado((b) => ({ ...b, [clave]: false }));
      if (await persistir(clave, "PERMITIDO")) setEstado((s) => ({ ...s, [clave]: "PERMITIDO" }));
    } else {
      // Denegado o sin soporte: queda como «Más tarde» y se explica cómo cambiarlo.
      setBloqueado((b) => ({ ...b, [clave]: true }));
      if (await persistir(clave, "MAS_TARDE")) setEstado((s) => ({ ...s, [clave]: "MAS_TARDE" }));
    }
    setOcupado(null);
  }

  async function masTarde(clave: Clave) {
    setError(null);
    setOcupado(clave);
    setBloqueado((b) => ({ ...b, [clave]: false }));
    if (await persistir(clave, "MAS_TARDE")) setEstado((s) => ({ ...s, [clave]: "MAS_TARDE" }));
    setOcupado(null);
  }

  function empezar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarPermisosAction(estado.ubicacion, estado.notificaciones, true);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(enOnboarding ? "/" : "/perfil");
    });
  }

  const listo = estado.ubicacion !== null && estado.notificaciones !== null;

  return (
    <>
      {enOnboarding ? (
        <Top titulo={t("perm.paso_2")} volverA="/ajustes/idioma-region" />
      ) : (
        <Top titulo={t("perm.meta")} volverA="/perfil" />
      )}
      {enOnboarding ? (
        <div aria-hidden className="flex gap-1 px-4 pt-3">
          <span className="h-1.5 flex-1 bg-signal" />
          <span className="h-1.5 flex-1 bg-signal" />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 pb-4">
        <h1 className="poster-2 break-words px-4 pt-4">
          {t("perm.dos_1")}
          <br />
          <span className="sn-hot">{t("perm.dos_2")}</span>
        </h1>

        <div className="flex flex-col gap-4 px-4">
          {DEFS.map(({ clave, titulo, porque, icono: Icono }, i) => {
            const v = estado[clave];
            const concedido = v === "PERMITIDO";
            return (
              <section
                key={clave}
                aria-labelledby={`perm-${clave}`}
                className={cn("flex flex-col gap-4 border-2 border-border p-4", v === null && "shadow-[var(--sn-shadow-hard)]")}
              >
                <div className="flex items-start gap-3">
                  <span className={cn("grid size-11 flex-none place-items-center border-2 border-border", concedido && "bg-signal text-ink")}>
                    <Icono aria-hidden className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id={`perm-${clave}`} className="sn-label break-words">
                        0{i + 1} / {t(titulo)}
                      </h2>
                      {concedido ? <span className="sn-status sn-status--ok">{t("perm.permitido")}</span> : null}
                      {v === "MAS_TARDE" ? <span className="sn-status sn-status--warn">{t("perm.mas_tarde")}</span> : null}
                    </div>
                    <p className="body-sm break-words text-text-muted">{t(porque)}</p>
                  </div>
                </div>
                {bloqueado[clave] ? (
                  <p role="status" className="body-sm break-words border-l-4 border-signal pl-3">
                    {t("perm.bloqueado", { permiso: t(titulo).toLowerCase() })}
                  </p>
                ) : null}
                {concedido ? (
                  <p className="body-sm break-words text-text-muted">
                    {t("perm.revocar")}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" className="min-w-[8rem] flex-1" disabled={ocupado !== null || !enLinea} onClick={() => masTarde(clave)}>
                    {t("perm.ahora_no")}
                  </Button>
                  <Button
                    variant={concedido ? "secondary" : "primary"}
                    className="min-w-[8rem] flex-1"
                    loading={ocupado === clave}
                    disabled={concedido || ocupado !== null || !enLinea}
                    onClick={() => permitir(clave)}
                  >
                    {concedido ? t("perm.listo") : t("perm.permitir")}
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Pie>
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        {!enLinea ? <p role="status" className="sn-meta">{t("aj.sin_conexion")}</p> : null}
        <p className="body-sm text-text-muted">{t("perm.cambiar")}</p>
        <Button
          variant={listo ? "primary" : "secondary"}
          size="lg"
          className="w-full justify-between"
          loading={pendiente}
          disabled={ocupado !== null || !enLinea}
          onClick={empezar}
        >
          <span>{enOnboarding ? t("perm.empezar") : t("perm.guardar")}</span> <span aria-hidden>↗</span>
        </Button>
      </Pie>
    </>
  );
}
