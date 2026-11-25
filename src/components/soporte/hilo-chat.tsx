"use client";

/* eslint-disable @next/next/no-img-element -- avatares locales, vistas previas y URLs firmadas temporales de Storage: next/image no aplica */

import { comprimirImagen } from "@/lib/soporte/comprimir-imagen";
import { BUCKET_ADJUNTOS, LIMITE_PDF_BYTES, TIPOS_IMAGEN, type AdjuntoSubido, type MensajeChat } from "@/lib/soporte/tipos";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, FileText, Paperclip, Send, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import s from "./chat-3d.module.css";

/**
 * Hilo y barra de escritura del chat de soporte (estilo neumórfico 3D). Lo usan la barbería (/panel/soporte) y SuperSU
 * (/admin/soporte): es presentacional, el servidor decide quién puede qué. Adjuntos: clip, arrastrar y soltar, o pegar con
 * Ctrl + V; las imágenes se comprimen aquí a menos de 500 KB y se suben directo al bucket privado.
 */

export type RespuestaRapidaChat = { id: string; titulo: string; atajo: string; cuerpo: string };

type Props = {
  mensajes: MensajeChat[];
  miRol: "BARBERIA" | "SUPERSU";
  nombreOtro: string;
  avatarOtro: string;
  /** Avatar propio junto a los mensajes enviados (opcional: SuperSU no lo usa). */
  avatarYo?: string;
  cerrada?: boolean;
  placeholder?: string;
  chipsInicio?: string[];
  /** Devuelve un mensaje de error o null si salió bien. */
  onEnviar: (cuerpo: string, adjunto: AdjuntoSubido | null) => Promise<string | null>;
  /** Garantiza la conversación y devuelve su id y el negocio para armar la ruta del adjunto. */
  prepararSubida: () => Promise<{ conversacionId: string; negocioId: string } | null>;
  respuestasRapidas?: RespuestaRapidaChat[];
  onGestionarRespuestas?: () => void;
};

type Pendiente = { archivo: File; vista: string | null };

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" });
const dia = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
function etiquetaDia(iso: string) {
  const d = dia(iso);
  const hoy = dia(new Date().toISOString());
  const ayer = dia(new Date(Date.now() - 86400000).toISOString());
  if (d === hoy) return "Hoy";
  if (d === ayer) return "Ayer";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
}

export function HiloChat({ mensajes, miRol, nombreOtro, avatarOtro, avatarYo, cerrada = false, placeholder, chipsInicio, onEnviar, prepararSubida, respuestasRapidas, onGestionarRespuestas }: Props) {
  const [texto, setTexto] = useState("");
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [visor, setVisor] = useState<string | null>(null);
  const [rapidasAbierto, setRapidasAbierto] = useState(false);
  const [indiceRapida, setIndiceRapida] = useState(0);
  const finRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  // Mantiene el hilo al final cuando llegan mensajes.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  // El campo crece solo con el texto.
  useEffect(() => {
    const c = campoRef.current;
    if (!c) return;
    c.style.height = "auto";
    c.style.height = `${Math.min(c.scrollHeight, 160)}px`;
  }, [texto]);

  useEffect(() => {
    const url = pendiente?.vista;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pendiente]);

  useEffect(() => {
    if (!visor) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setVisor(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [visor]);

  // Autocompletado con «/» al inicio del texto (solo si hay respuestas rápidas).
  const filtro = texto.startsWith("/") && !texto.includes(" ") ? texto.toLowerCase() : null;
  const sugeridas = useMemo(() => {
    if (!respuestasRapidas) return [];
    if (rapidasAbierto && filtro === null) return respuestasRapidas;
    if (filtro !== null) return respuestasRapidas.filter((r) => r.atajo.startsWith(filtro) || r.titulo.toLowerCase().includes(filtro.slice(1)));
    return [];
  }, [respuestasRapidas, rapidasAbierto, filtro]);
  const mostrarRapidas = sugeridas.length > 0 && (rapidasAbierto || filtro !== null);

  function usarRapida(r: RespuestaRapidaChat) {
    setTexto(r.cuerpo);
    setRapidasAbierto(false);
    setIndiceRapida(0);
    requestAnimationFrame(() => campoRef.current?.focus());
  }

  const tomarArchivo = useCallback((archivo: File | null | undefined) => {
    if (!archivo) return;
    setError(null);
    const esImagen = (TIPOS_IMAGEN as readonly string[]).includes(archivo.type);
    const esPdf = archivo.type === "application/pdf";
    if (!esImagen && !esPdf) return setError("Solo puedes adjuntar imágenes (JPG, PNG o WebP) o PDF.");
    if (esPdf && archivo.size > LIMITE_PDF_BYTES) return setError("El PDF supera los 5 MB.");
    setPendiente({ archivo, vista: esImagen ? URL.createObjectURL(archivo) : null });
  }, []);

  async function enviar() {
    const cuerpo = texto.trim();
    if (enviando || (!cuerpo && !pendiente)) return;
    setEnviando(true);
    setError(null);
    let adjunto: AdjuntoSubido | null = null;
    if (pendiente) {
      const prep = await prepararSubida();
      if (!prep) {
        setEnviando(false);
        return setError("No pudimos preparar el archivo. Inténtalo de nuevo.");
      }
      let blob: Blob = pendiente.archivo;
      let extension = "pdf";
      let tipo: "IMAGEN" | "PDF" = "PDF";
      if (pendiente.archivo.type !== "application/pdf") {
        const c = await comprimirImagen(pendiente.archivo);
        if (!c) {
          setEnviando(false);
          return setError("No pudimos reducir la imagen a menos de 500 KB. Prueba con otra.");
        }
        blob = c.blob;
        extension = c.extension;
        tipo = "IMAGEN";
      }
      const ruta = `${prep.negocioId}/${prep.conversacionId}/${crypto.randomUUID()}.${extension}`;
      const { error: errSubida } = await createClient().storage.from(BUCKET_ADJUNTOS).upload(ruta, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
      if (errSubida) {
        setEnviando(false);
        return setError("No pudimos subir el archivo. Inténtalo de nuevo.");
      }
      const base = pendiente.archivo.name.replace(/\.[^.]+$/, "").slice(0, 120) || "adjunto";
      adjunto = { ruta, tipo, nombre: `${base}.${extension}` };
    }
    const err = await onEnviar(cuerpo, adjunto);
    setEnviando(false);
    if (err) return setError(err);
    setTexto("");
    setPendiente(null);
    campoRef.current?.focus();
  }

  function alTeclear(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mostrarRapidas) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        return setIndiceRapida((i) => (i + 1) % sugeridas.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        return setIndiceRapida((i) => (i - 1 + sugeridas.length) % sugeridas.length);
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        return usarRapida(sugeridas[Math.min(indiceRapida, sugeridas.length - 1)]);
      }
      if (e.key === "Escape") return setRapidasAbierto(false);
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void enviar();
    }
  }

  function alPegar(e: React.ClipboardEvent) {
    const archivo = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (archivo) {
      e.preventDefault();
      tomarArchivo(archivo);
    }
  }

  const porDia = useMemo(() => {
    const grupos: { dia: string; etiqueta: string; items: MensajeChat[] }[] = [];
    for (const m of mensajes) {
      const d = dia(m.createdAt);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.dia === d) ultimo.items.push(m);
      else grupos.push({ dia: d, etiqueta: etiquetaDia(m.createdAt), items: [m] });
    }
    return grupos;
  }, [mensajes]);

  return (
    <>
      <div
        className={cn(s.hilo, arrastrando && s.arrastre)}
        role="log"
        aria-live="polite"
        aria-label="Mensajes del chat"
        onDragOver={(e) => {
          if (cerrada) return;
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (!cerrada) tomarArchivo(e.dataTransfer.files[0]);
        }}
      >
        {mensajes.length === 0 ? (
          <div className={s.vacio}>
            <p>{chipsInicio ? "Cuéntanos en qué te ayudamos. Normalmente respondemos en minutos." : "Todavía no hay mensajes en esta conversación."}</p>
            {chipsInicio ? (
              <div className={s.chips}>
                {chipsInicio.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={s.chip}
                    onClick={() => {
                      setTexto(c);
                      campoRef.current?.focus();
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          porDia.map((g) => (
            <div key={g.dia} style={{ display: "contents" }}>
              <span className={s.fecha}>{g.etiqueta}</span>
              {g.items.map((m) => {
                const yo = m.remitenteRol === miRol;
                return (
                  <div key={m.id} className={cn(s.fila, yo && s.filaYo)}>
                    {!yo ? <img src={avatarOtro} alt="" className={s.miniAvatar} /> : avatarYo ? <img src={avatarYo} alt="" className={s.miniAvatar} /> : null}
                    <div className={cn(s.columna, yo && s.columnaYo)}>
                      <span className={s.meta}>
                        {yo ? (
                          <>
                            {hora(m.createdAt)} · Tú {m.leido ? <CheckCheck className="size-3.5" aria-label="Leído" /> : <Check className="size-3.5" aria-label="Enviado" />}
                          </>
                        ) : (
                          <>
                            {nombreOtro} · {hora(m.createdAt)}
                          </>
                        )}
                      </span>
                      <div className={cn(s.burbuja, yo ? s.burbujaYo : s.burbujaOtro)}>
                        {m.adjunto ? (
                          <div className={s.adjuntos}>
                            {m.adjunto.tipo === "IMAGEN" && m.adjunto.url ? (
                              <button type="button" className={s.miniatura} onClick={() => setVisor(m.adjunto!.url)} aria-label={`Ampliar imagen ${m.adjunto.nombre}`}>
                                {}
                                <img src={m.adjunto.url} alt={m.adjunto.nombre} loading="lazy" />
                              </button>
                            ) : (
                              <a className={s.pdf} href={m.adjunto.url ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!m.adjunto.url}>
                                <FileText className="size-5 shrink-0" aria-hidden />
                                <span>{m.adjunto.nombre}</span>
                              </a>
                            )}
                          </div>
                        ) : null}
                        {m.cuerpo}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

      <div className={s.compositor}>
        {mostrarRapidas ? (
          <div className={s.rapidas} role="listbox" aria-label="Respuestas rápidas">
            {sugeridas.map((r, i) => (
              <button key={r.id} type="button" role="option" aria-selected={i === indiceRapida} className={cn(s.rapida, i === indiceRapida && s.rapidaActiva)} onMouseEnter={() => setIndiceRapida(i)} onClick={() => usarRapida(r)}>
                <span>
                  <span className={s.atajo}>{r.atajo}</span> · {r.titulo}
                </span>
                <small>{r.cuerpo}</small>
              </button>
            ))}
            {onGestionarRespuestas ? (
              <button type="button" className={s.rapida} onClick={onGestionarRespuestas}>
                <span className={s.atajo}>Gestionar respuestas…</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {pendiente ? (
          <div className={s.previas}>
            <span className={s.previa}>
              {pendiente.vista ? <img src={pendiente.vista} alt="" /> : <FileText className="size-6" aria-hidden />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{pendiente.archivo.name}</span>
              <button type="button" className={s.quitar} onClick={() => setPendiente(null)} aria-label="Quitar adjunto">
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className={s.error}>
            {error}
          </p>
        ) : null}

        <div className={s.barra}>
          <input ref={archivoRef} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { tomarArchivo(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className={s.boton} onClick={() => archivoRef.current?.click()} disabled={cerrada || enviando} aria-label="Adjuntar imagen o PDF">
            <Paperclip className="size-5" aria-hidden />
          </button>
          {respuestasRapidas ? (
            <button type="button" className={s.boton} onClick={() => { setRapidasAbierto((v) => !v); setIndiceRapida(0); }} disabled={cerrada} aria-label="Respuestas rápidas" aria-expanded={mostrarRapidas}>
              <Zap className="size-5" aria-hidden />
            </button>
          ) : null}
          <label htmlFor="chat-soporte-campo" className="sr-only">
            Mensaje
          </label>
          <textarea
            id="chat-soporte-campo"
            ref={campoRef}
            rows={1}
            value={texto}
            maxLength={2000}
            disabled={cerrada}
            onChange={(e) => {
              setTexto(e.target.value);
              setIndiceRapida(0);
            }}
            onKeyDown={alTeclear}
            onPaste={alPegar}
            placeholder={cerrada ? "Esta conversación está cerrada." : (placeholder ?? "Escribe un mensaje o pega un pantallazo (Ctrl + V)…")}
            className={s.campo}
          />
          <button type="button" className={cn(s.boton, s.enviar)} onClick={() => void enviar()} disabled={cerrada || enviando || (!texto.trim() && !pendiente)} aria-label="Enviar mensaje">
            <Send className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {visor ? (
        <div className={s.visor} role="dialog" aria-modal="true" aria-label="Imagen ampliada" onClick={() => setVisor(null)}>
          <button type="button" className={s.visorCerrar} onClick={() => setVisor(null)} aria-label="Cerrar">
            ×
          </button>
          {}
          <img src={visor} alt="Imagen del chat ampliada" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
    </>
  );
}
