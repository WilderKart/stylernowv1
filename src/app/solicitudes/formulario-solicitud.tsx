"use client";

import { Turnstile, type ControlTurnstile } from "@/components/seguridad/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionState, useMemo, useRef, useState } from "react";
import { radicarSolicitud, type ResultadoRadicacion } from "./actions";

export type TipoPublico = { codigo: string; categoria: string; nombre: string; requiere_identificacion: boolean };

const CATEGORIAS: Record<string, string> = {
  DATOS_PERSONALES: "Mis datos personales",
  CONSUMIDOR: "Servicio, cobro o reserva",
  PQRS: "Petición, queja, reclamo o sugerencia",
  SEGURIDAD: "Seguridad y privacidad",
  LEGAL: "Legal y contractual",
  OPERATIVO: "Cuenta y plataforma",
};

const campo =
  "min-h-12 w-full min-w-0 border-2 border-border bg-bg px-3 py-2 text-[15px] leading-[22px] text-text outline-none focus:shadow-hard";
const etiqueta = "font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase";

export function FormularioSolicitud({ tipos }: { tipos: TipoPublico[] }) {
  const [estado, accion, pendiente] = useActionState<ResultadoRadicacion | null, FormData>(radicarSolicitud, null);
  const [tipo, setTipo] = useState("");
  const [ts, setTs] = useState<string | null>(null);
  const controlTs = useRef<ControlTurnstile>(null);
  // Una clave por carga del formulario: un doble clic o un reintento no crea dos casos.
  const idem = useMemo(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : ""), []);
  const [copiado, setCopiado] = useState(false);

  const grupos = useMemo(() => {
    const m = new Map<string, TipoPublico[]>();
    for (const t of tipos) m.set(t.categoria, [...(m.get(t.categoria) ?? []), t]);
    return [...m.entries()];
  }, [tipos]);
  const pideDocumento = tipos.find((t) => t.codigo === tipo)?.requiere_identificacion ?? false;

  if (estado?.ok) {
    return (
      <section className="mt-8 border-2 border-border p-5" aria-live="polite">
        <h2 className="text-xl font-bold">Recibimos tu solicitud</h2>
        <p className="mt-3 text-sm text-text-muted">Tu número de radicación es</p>
        <p className="font-mono text-2xl font-bold">{estado.numero}</p>
        {estado.fechaLimite ? (
          <p className="mt-3 text-sm">
            {estado.origen === "LEGAL_VERIFICADO"
              ? "Plazo legal para responderte: "
              : estado.origen === "LEGAL_PROVISIONAL"
                ? "Fecha estimada de respuesta (plazo en revisión jurídica): "
                : "Meta interna de respuesta (no es un plazo legal): "}
            <strong>{new Date(estado.fechaLimite).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" })}</strong>
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-6">
          Te enviamos un correo de confirmación con tu enlace personal de seguimiento. <strong>Guárdalo:</strong> con él (y solo con él) podrás ver el
          estado, responder y completar información. Quien conozca únicamente el número no puede ver tu caso.
        </p>
        <div className="mt-3 break-all border-2 border-dashed border-border p-3 font-mono text-xs">{estado.enlace}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(estado.enlace);
                setCopiado(true);
              } catch {
                setCopiado(false);
              }
            }}
          >
            {copiado ? "Enlace copiado" : "Copiar enlace"}
          </Button>
          <a className="inline-flex min-h-12 items-center underline" href={estado.enlace.replace(/^https?:\/\/[^/]+/, "")}>
            Ver mi caso
          </a>
        </div>
        {estado.adjuntosRechazados > 0 ? (
          <p className="mt-3 text-sm text-danger">No pudimos guardar {estado.adjuntosRechazados} adjunto(s). Puedes volver a enviarlos desde tu enlace de seguimiento.</p>
        ) : null}
      </section>
    );
  }

  return (
    <form
      action={(fd) => {
        fd.set("ts", ts ?? "");
        accion(fd);
        controlTs.current?.reiniciar();
      }}
      className="mt-8 flex flex-col gap-5"
      encType="multipart/form-data"
    >
      <input type="hidden" name="idem" value={idem} />
      {/* Honeypot: invisible para personas; los bots lo llenan. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No llenar
          <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="tipo" className={etiqueta}>
          ¿Qué necesitas?
        </label>
        <select id="tipo" name="tipo" required value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
          <option value="">Elige una opción…</option>
          {grupos.map(([cat, lista]) => (
            <optgroup key={cat} label={CATEGORIAS[cat] ?? cat}>
              {lista.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <Input label="Tu nombre completo" name="nombre" required minLength={2} maxLength={120} autoComplete="name" />
      <Input label="Correo electrónico" name="email" type="email" required maxLength={254} autoComplete="email" />
      <Input label="Celular (opcional)" name="telefono" type="tel" maxLength={20} autoComplete="tel" />

      {pideDocumento ? (
        <fieldset className="flex flex-col gap-3 border-2 border-dashed border-border p-3">
          <legend className={etiqueta}>Verificación de identidad</legend>
          <p className="text-xs leading-5 text-text-muted">
            Para proteger tus datos, necesitamos comprobar que eres el titular. Pedimos solo tipo y número de documento; no envíes copias del documento a menos
            que te las solicitemos.
          </p>
          <div className="flex flex-col gap-2">
            <label htmlFor="id_tipo" className={etiqueta}>
              Tipo de documento
            </label>
            <select id="id_tipo" name="id_tipo" required className={campo}>
              <option value="">Elige…</option>
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
              <option value="TI">Tarjeta de identidad</option>
              <option value="NIT">NIT</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <Input label="Número de documento" name="id_numero" required minLength={4} maxLength={20} inputMode="text" autoComplete="off" />
        </fieldset>
      ) : null}

      <Input label="Asunto" name="asunto" required minLength={5} maxLength={160} />
      <div className="flex flex-col gap-2">
        <label htmlFor="descripcion" className={etiqueta}>
          Cuéntanos qué pasó o qué necesitas
        </label>
        <textarea id="descripcion" name="descripcion" required minLength={10} maxLength={5000} rows={6} className={campo} />
        <p className="text-xs text-text-muted">No incluyas contraseñas, datos bancarios ni información de salud, a menos que sea imprescindible para tu caso.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Establecimiento (si aplica)" name="establecimiento" maxLength={60} />
        <Input label="Referencia de la reserva (si aplica)" name="reserva" maxLength={50} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="archivos" className={etiqueta}>
          Adjuntos (opcional)
        </label>
        <input id="archivos" name="archivos" type="file" multiple accept="application/pdf,image/png,image/jpeg" className="text-sm" />
        <p className="text-xs text-text-muted">Hasta 3 archivos PDF, PNG o JPG, de máximo 5 MB cada uno.</p>
      </div>

      <label className="flex items-start gap-3 text-sm leading-6">
        <input type="checkbox" name="acepta_politica" required className="mt-1 size-5 shrink-0" />
        <span>
          Leí la{" "}
          <a className="underline" href="/legal/politica-de-datos" target="_blank" rel="noopener noreferrer">
            Política de Tratamiento de Datos
          </a>{" "}
          y autorizo a TAWILSTACK S.A.S. a usar estos datos para atender mi solicitud.
        </span>
      </label>

      <Turnstile ref={controlTs} accion="solicitud" onToken={setTs} />

      {estado && !estado.ok ? (
        <p role="alert" className="border-2 border-danger p-3 text-sm text-danger">
          {estado.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pendiente || !ts}>
        {pendiente ? "Enviando…" : "Radicar solicitud"}
      </Button>
    </form>
  );
}
