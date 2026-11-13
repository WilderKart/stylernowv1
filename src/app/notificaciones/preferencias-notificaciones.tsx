"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { useIdioma } from "@/lib/i18n/proveedor";
import { useEffect, useState, useTransition } from "react";
import { desuscribirPushAction, guardarPreferenciaAction, suscribirPushAction } from "./preferencias-actions";

export interface PreferenciaAviso {
  evento: string;
  audiencia: "CLIENTE" | "NEGOCIO";
  esencial: boolean;
  descripcion: string;
  email_activo: boolean;
  push_activo: boolean;
}

const TEXTOS = {
  es: {
    titulo: "Cómo te avisamos",
    push_titulo: "Avisos en este dispositivo",
    push_no_config: "Los avisos push todavía no están disponibles.",
    push_no_soportado: "Este navegador no admite avisos push.",
    push_bloqueado: "Bloqueaste los avisos para este sitio. Actívalos desde los ajustes del navegador.",
    push_activo: "Recibes avisos en este dispositivo.",
    push_inactivo: "Activa los avisos para enterarte al instante de tus citas y pagos.",
    activar: "Activar avisos",
    desactivar: "Desactivar",
    cliente: "Tus citas y pagos",
    negocio: "Tu negocio",
    email: "Correo",
    push: "Push",
    obligatorio: "Obligatorio",
    nota: "Los correos de confirmación, cancelación, pagos y reembolsos son obligatorios: son la constancia de la operación. La publicidad por correo se controla en Privacidad.",
    error: "No pudimos activar los avisos. Intenta de nuevo.",
  },
  en: {
    titulo: "How we notify you",
    push_titulo: "Alerts on this device",
    push_no_config: "Push alerts are not available yet.",
    push_no_soportado: "This browser does not support push alerts.",
    push_bloqueado: "You blocked alerts for this site. Turn them on in your browser settings.",
    push_activo: "You receive alerts on this device.",
    push_inactivo: "Turn on alerts to hear about your appointments and payments right away.",
    activar: "Turn on alerts",
    desactivar: "Turn off",
    cliente: "Your appointments and payments",
    negocio: "Your business",
    email: "Email",
    push: "Push",
    obligatorio: "Required",
    nota: "Confirmation, cancellation, payment and refund emails are required: they are the record of the transaction. Marketing email is controlled in Privacy.",
    error: "We could not turn on alerts. Please try again.",
  },
} as const;

function claveAplicacion(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const salida = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) salida[i] = crudo.charCodeAt(i);
  return salida;
}

type EstadoPush = "cargando" | "no_config" | "no_soportado" | "bloqueado" | "activo" | "inactivo";

export function PreferenciasNotificaciones({
  preferencias,
  vapidPublica,
}: {
  preferencias: PreferenciaAviso[];
  vapidPublica: string | null;
}) {
  const idioma = useIdioma();
  const t = TEXTOS[idioma === "en" ? "en" : "es"];
  const [items, setItems] = useState(preferencias);
  const [error, setError] = useState<string | null>(null);
  const [estadoPush, setEstadoPush] = useState<EstadoPush>("cargando");
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    async function detectar(): Promise<EstadoPush> {
      if (!vapidPublica) return "no_config";
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") return "no_soportado";
      if (Notification.permission === "denied") return "bloqueado";
      const reg = await navigator.serviceWorker.ready;
      return (await reg.pushManager.getSubscription()) ? "activo" : "inactivo";
    }
    detectar()
      .then((e) => vivo && setEstadoPush(e))
      .catch(() => vivo && setEstadoPush("no_soportado"));
    return () => {
      vivo = false;
    };
  }, [vapidPublica]);

  function activarPush() {
    if (!vapidPublica) return;
    setError(null);
    iniciar(async () => {
      try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          setEstadoPush(permiso === "denied" ? "bloqueado" : "inactivo");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveAplicacion(vapidPublica) });
        const json = sub.toJSON();
        const r = await suscribirPushAction({ endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } });
        if (!r.ok) {
          await sub.unsubscribe().catch(() => undefined);
          setError(r.error);
          return;
        }
        setEstadoPush("activo");
      } catch {
        setError(t.error);
      }
    });
  }

  function desactivarPush() {
    setError(null);
    iniciar(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await desuscribirPushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setEstadoPush("inactivo");
      } catch {
        setError(t.error);
      }
    });
  }

  function cambiar(evento: string, canal: "EMAIL" | "PUSH", activo: boolean) {
    const previo = items;
    setItems((l) => l.map((p) => (p.evento === evento ? { ...p, [canal === "EMAIL" ? "email_activo" : "push_activo"]: activo } : p)));
    setError(null);
    iniciar(async () => {
      const r = await guardarPreferenciaAction(evento, canal, activo);
      if (!r.ok) {
        setItems(previo);
        setError(r.error);
      }
    });
  }

  const grupos = (["CLIENTE", "NEGOCIO"] as const)
    .map((a) => ({ audiencia: a, filas: items.filter((p) => p.audiencia === a) }))
    .filter((g) => g.filas.length > 0);

  const textoPush: Record<EstadoPush, string> = {
    cargando: "",
    no_config: t.push_no_config,
    no_soportado: t.push_no_soportado,
    bloqueado: t.push_bloqueado,
    activo: t.push_activo,
    inactivo: t.push_inactivo,
  };

  return (
    <section aria-labelledby="pref-avisos" className="mt-8 flex flex-col gap-4 px-4">
      <h2 id="pref-avisos" className="poster-3">
        {t.titulo}
        <span className="sn-hot">.</span>
      </h2>

      <div className="flex flex-col gap-3 border-2 border-border p-4">
        <h3 className="sn-num">{t.push_titulo}</h3>
        <p className="body-sm" role="status">
          {textoPush[estadoPush]}
        </p>
        {estadoPush === "inactivo" ? (
          <Button variant="primary" size="md" onClick={activarPush} disabled={pendiente}>
            {t.activar}
          </Button>
        ) : null}
        {estadoPush === "activo" ? (
          <Button variant="secondary" size="md" onClick={desactivarPush} disabled={pendiente}>
            {t.desactivar}
          </Button>
        ) : null}
      </div>

      {error ? <ErrorAviso>{error}</ErrorAviso> : null}

      {grupos.map((g) => (
        <fieldset key={g.audiencia} className="m-0 flex flex-col border-2 border-border p-0">
          <legend className="sn-num px-2">{g.audiencia === "CLIENTE" ? t.cliente : t.negocio}</legend>
          {g.filas.map((p) => (
            <div key={p.evento} className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <span className="body-sm min-w-0 flex-1 break-words">{p.descripcion}</span>
              <span className="flex flex-none items-center gap-4">
                <label className="flex items-center gap-2 body-sm">
                  <input
                    type="checkbox"
                    checked={p.email_activo || p.esencial}
                    disabled={p.esencial || pendiente}
                    onChange={(e) => cambiar(p.evento, "EMAIL", e.target.checked)}
                  />
                  {t.email}
                  {p.esencial ? <span className="sn-meta">({t.obligatorio})</span> : null}
                </label>
                <label className="flex items-center gap-2 body-sm">
                  <input
                    type="checkbox"
                    checked={p.push_activo}
                    disabled={pendiente}
                    onChange={(e) => cambiar(p.evento, "PUSH", e.target.checked)}
                  />
                  {t.push}
                </label>
              </span>
            </div>
          ))}
        </fieldset>
      ))}
      <p className="body-sm text-text-muted">{t.nota}</p>
    </section>
  );
}
