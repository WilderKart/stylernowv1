"use client";

import { Turnstile, type ControlTurnstile } from "@/components/seguridad/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { consultarCaso, reenviarEnlace, responderCaso, type CasoPublico } from "../actions";

const ESTADOS: Record<string, string> = {
  NUEVO: "Recibida",
  EN_REVISION: "En revisión",
  ASIGNADO: "Asignada a una persona del equipo",
  EN_GESTION: "En gestión",
  ESPERANDO_SOLICITANTE: "Necesitamos información tuya",
  ESPERANDO_TERCERO: "Esperando a un tercero",
  ESCALADO: "Escalada a un supervisor",
  RESPONDIDO: "Respondida",
  RESUELTO: "Resuelta",
  CERRADO: "Cerrada",
  REABIERTO: "Reabierta",
  DESISTIDO: "Cerrada por falta de respuesta",
  TRASLADADO: "Trasladada a quien corresponde",
};

const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" }) : "—";

const campo = "min-h-12 w-full min-w-0 border-2 border-border bg-bg px-3 py-2 text-[15px] leading-[22px] text-text outline-none focus:shadow-hard";

export function VistaSeguimiento() {
  const [numero, setNumero] = useState("");
  const [token, setToken] = useState("");
  const [caso, setCaso] = useState<CasoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [perdi, setPerdi] = useState(false);
  const [email, setEmail] = useState("");
  const [ts, setTs] = useState<string | null>(null);
  const controlTs = useRef<ControlTurnstile>(null);

  async function consultar(n: string, t: string) {
    setCargando(true);
    setError(null);
    const r = await consultarCaso(n, t);
    setCargando(false);
    if (r.ok) setCaso(r.caso);
    else {
      setCaso(null);
      setError(r.error);
    }
  }

  // El enlace personal trae «#SN-AAAA-NNNNNN.<token>». El fragmento nunca viaja al servidor en la navegación ni en el Referer.
  useEffect(() => {
    const id = setTimeout(() => {
      const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      const [n, t] = h.split(".");
      if (n && t) {
        setNumero(n);
        setToken(t);
        void consultar(n, t);
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    const r = await responderCaso(numero, token, mensaje);
    if (!r.ok) return setAviso(r.error ?? "No pudimos enviar tu mensaje.");
    setMensaje("");
    setAviso("Mensaje enviado. Gracias.");
    await consultar(numero, token);
  }

  async function pedirEnlace(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    const r = await reenviarEnlace(numero, email, ts);
    controlTs.current?.reiniciar();
    setAviso(
      r.ok
        ? "Si el número y el correo coinciden con una solicitud, te enviamos un enlace nuevo. Revisa tu bandeja y la carpeta de spam."
        : (r.error ?? "No pudimos procesar la solicitud."),
    );
  }

  if (caso) {
    return (
      <section className="mt-6" aria-live="polite">
        <p className="font-mono text-xl font-bold">{caso.numero}</p>
        <p className="mt-1 text-[15px]">{caso.asunto}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-text-muted">Estado</dt><dd className="font-bold">{ESTADOS[caso.estado] ?? caso.estado}</dd></div>
          <div><dt className="text-text-muted">Tipo</dt><dd>{caso.tipo ?? "—"}</dd></div>
          <div><dt className="text-text-muted">Recibida</dt><dd>{fecha(caso.recibido_at)}</dd></div>
          <div>
            <dt className="text-text-muted">
              {caso.plazo_origen === "LEGAL_VERIFICADO" ? "Plazo legal de respuesta" : caso.plazo_origen === "LEGAL_PROVISIONAL" ? "Fecha estimada (plazo en revisión)" : "Meta interna de respuesta"}
            </dt>
            <dd>{fecha(caso.fecha_limite)}{caso.prorroga ? " (ampliado)" : ""}</dd>
          </div>
          <div><dt className="text-text-muted">Respuesta de fondo</dt><dd>{fecha(caso.respondido_at)}</dd></div>
          <div><dt className="text-text-muted">Cierre</dt><dd>{fecha(caso.cerrado_at)}</dd></div>
        </dl>
        {caso.esperando_solicitante ? (
          <p className="mt-4 border-2 border-signal p-3 text-sm">Necesitamos que completes o aclares tu solicitud. Escríbelo abajo; el plazo de respuesta se cuenta desde que la completes.</p>
        ) : null}

        <h2 className="mt-6 text-lg font-bold">Mensajes</h2>
        <ul className="mt-2 flex flex-col gap-3">
          {caso.mensajes.map((m, i) => (
            <li key={i} className={`border-2 p-3 text-sm ${m.actor === "SOLICITANTE" || m.actor === "CLIENTE" ? "border-border" : "border-border bg-surface"}`}>
              <p className="font-mono text-[11px] text-text-muted uppercase">
                {m.actor === "SOLICITANTE" || m.actor === "CLIENTE" ? "Tú" : "StylerNow"} · {fecha(m.at)}
              </p>
              <p className="mt-1 whitespace-pre-line">{m.mensaje}</p>
            </li>
          ))}
        </ul>

        {caso.estado !== "CERRADO" && caso.estado !== "DESISTIDO" ? (
          <form onSubmit={enviar} className="mt-4 flex flex-col gap-3">
            <label htmlFor="msg" className="font-mono text-xs font-bold tracking-wide uppercase">Escribir un mensaje</label>
            <textarea id="msg" value={mensaje} onChange={(e) => setMensaje(e.target.value)} minLength={2} maxLength={5000} rows={4} required className={campo} />
            <Button type="submit" variant="primary" disabled={mensaje.trim().length < 2}>Enviar mensaje</Button>
          </form>
        ) : null}
        {aviso ? <p role="status" className="mt-3 text-sm">{aviso}</p> : null}

        <h2 className="mt-6 text-lg font-bold">Historial</h2>
        <ol className="mt-2 flex flex-col gap-1 text-sm">
          {caso.historial.map((h, i) => (
            <li key={i}>{fecha(h.at)} · {h.estado ? (ESTADOS[h.estado] ?? h.estado) : h.evento.toLowerCase().replaceAll("_", " ")}</li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-[15px] leading-6 text-text-muted">
        Abre el enlace personal que te enviamos al correo, o escribe tu número de radicación y tu código de seguimiento (la parte que aparece después del punto en el enlace).
      </p>
      <form onSubmit={(e) => { e.preventDefault(); void consultar(numero, token); }} className="flex flex-col gap-4">
        <Input label="Número de radicación" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="SN-2026-000123" required />
        <Input label="Código de seguimiento" value={token} onChange={(e) => setToken(e.target.value.trim())} autoComplete="off" required />
        <Button type="submit" variant="primary" disabled={cargando}>{cargando ? "Buscando…" : "Consultar"}</Button>
      </form>
      {error ? <p role="alert" className="border-2 border-danger p-3 text-sm text-danger">{error}</p> : null}

      <button type="button" className="self-start text-sm underline" onClick={() => setPerdi((v) => !v)}>Perdí mi enlace</button>
      {perdi ? (
        <form onSubmit={pedirEnlace} className="flex flex-col gap-3 border-2 border-dashed border-border p-3">
          <p className="text-xs text-text-muted">Escribe el número de radicación (arriba) y el correo con el que radicaste. Te enviaremos un enlace nuevo; el anterior dejará de funcionar.</p>
          <Input label="Correo con el que radicaste" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Turnstile ref={controlTs} accion="seguimiento" onToken={setTs} />
          <Button type="submit" variant="secondary" disabled={!ts}>Enviarme un enlace nuevo</Button>
        </form>
      ) : null}
      {aviso ? <p role="status" className="text-sm">{aviso}</p> : null}
    </div>
  );
}
