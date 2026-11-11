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

type Clave = "ubicacion" | "notificaciones";

const DEFS: { clave: Clave; titulo: string; porque: string; icono: typeof MapPin }[] = [
  {
    clave: "ubicacion",
    titulo: "Ubicación",
    porque: "Para mostrarte negocios cerca y activar «Llegué» cuando estés en el local. Solo mientras usas la app.",
    icono: MapPin,
  },
  {
    clave: "notificaciones",
    titulo: "Notificaciones",
    porque: "Recordatorios de tu cita y mensajes del negocio. Las ofertas van aparte y son opcionales.",
    icono: Bell,
  },
];

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
        <Top titulo="Paso 02 / 02" volverA="/ajustes/idioma-region" />
      ) : (
        <Top titulo="Permisos" volverA="/perfil" />
      )}
      {enOnboarding ? (
        <div aria-hidden className="flex gap-1 px-4 pt-3">
          <span className="h-1.5 flex-1 bg-signal" />
          <span className="h-1.5 flex-1 bg-signal" />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 pb-4">
        <h1 className="poster-2 break-words px-4 pt-4">
          Dos permisos.
          <br />
          <span className="sn-hot">Nada más.</span>
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
                        0{i + 1} / {titulo}
                      </h2>
                      {concedido ? <span className="sn-status sn-status--ok">Permitido</span> : null}
                      {v === "MAS_TARDE" ? <span className="sn-status sn-status--warn">Más tarde</span> : null}
                    </div>
                    <p className="body-sm break-words text-text-muted">{porque}</p>
                  </div>
                </div>
                {bloqueado[clave] ? (
                  <p role="status" className="body-sm break-words border-l-4 border-signal pl-3">
                    Tu navegador no nos dejó activarlo. Para cambiarlo, toca el candado junto a la dirección del sitio (o los ajustes de tu
                    teléfono, en Aplicaciones, StylerNow) y permite {titulo.toLowerCase()}.
                  </p>
                ) : null}
                {concedido ? (
                  <p className="body-sm break-words text-text-muted">
                    Para revocarlo, hazlo desde el candado del navegador o los ajustes de tu teléfono; aquí no podemos quitarlo por ti.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" className="min-w-[8rem] flex-1" disabled={ocupado !== null || !enLinea} onClick={() => masTarde(clave)}>
                    Ahora no
                  </Button>
                  <Button
                    variant={concedido ? "secondary" : "primary"}
                    className="min-w-[8rem] flex-1"
                    loading={ocupado === clave}
                    disabled={concedido || ocupado !== null || !enLinea}
                    onClick={() => permitir(clave)}
                  >
                    {concedido ? "Listo" : "Permitir"}
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Pie>
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        {!enLinea ? <p role="status" className="sn-meta">Sin conexión: no podemos guardar ahora.</p> : null}
        <p className="body-sm text-text-muted">Puedes cambiarlos cuando quieras en los ajustes de tu teléfono.</p>
        <Button
          variant={listo ? "primary" : "secondary"}
          size="lg"
          className="w-full justify-between"
          loading={pendiente}
          disabled={ocupado !== null || !enLinea}
          onClick={empezar}
        >
          <span>{enOnboarding ? "Empezar" : "Guardar"}</span> <span aria-hidden>↗</span>
        </Button>
      </Pie>
    </>
  );
}
