"use client";

import { HiloChat, type RespuestaRapidaChat } from "@/components/soporte/hilo-chat";
import s from "@/components/soporte/chat-3d.module.css";
import { normalizar } from "@/lib/busqueda/difuso";
import type { AdjuntoSubido } from "@/lib/soporte/tipos";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cambiarEstadoChatAdmin,
  enviarMensajeChatAdmin,
  guardarRespuestaRapida,
  listarChatsAdmin,
  listarRespuestasRapidas,
  marcarChatLeidoAdmin,
  obtenerChatAdmin,
  prepararAdjuntosChatAdmin,
  type ChatAdmin as DatosChat,
  type ConversacionAdmin,
  type RespuestaRapida,
} from "./chat-actions";

const AVATAR_NEGOCIO = "/avatars/negocio.svg";
type Filtro = "todos" | "abiertas" | "cerradas" | "sin_leer";

const hora = (iso: string) => new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" });
const horaCorta = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) === hoy
    ? d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" })
    : d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });
};
const PLAN: Record<string, string> = { ESSENTIAL: "Essential", STUDIO: "Studio", PRESTIGE: "Prestige", SIGNATURE: "Signature" };

export function ChatAdmin({ conversacionesIniciales, errorInicial, seleccionInicial }: { conversacionesIniciales: ConversacionAdmin[]; errorInicial: string | null; seleccionInicial?: string | null }) {
  const [lista, setLista] = useState(conversacionesIniciales);
  const [seleccion, setSeleccion] = useState<string | null>(seleccionInicial && conversacionesIniciales.some((c) => c.id === seleccionInicial) ? seleccionInicial : null);
  const [chat, setChat] = useState<DatosChat | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState(errorInicial);
  const [rapidas, setRapidas] = useState<RespuestaRapida[]>([]);
  const [gestionando, setGestionando] = useState(false);
  const seleccionRef = useRef(seleccion);
  useEffect(() => {
    seleccionRef.current = seleccion;
  }, [seleccion]);

  const recargarLista = useCallback(async () => {
    const res = await listarChatsAdmin();
    if (res.ok) setLista(res.data);
  }, []);

  const recargarChat = useCallback(async (id: string) => {
    const res = await obtenerChatAdmin(id);
    if (!res.ok) return setError(res.error);
    setError(null);
    setChat(res.data);
    if (res.data.conversacion.noLeidosAdmin > 0) {
      void marcarChatLeidoAdmin(id).then(() => listarChatsAdmin().then((r) => r.ok && setLista(r.data)));
    }
  }, []);

  const cargarRapidas = useCallback(async () => {
    const res = await listarRespuestasRapidas();
    if (res.ok) setRapidas(res.data);
  }, []);

  useEffect(() => {
    // Carga inicial de las plantillas (una sola vez al abrir la bandeja).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    void cargarRapidas();
  }, [cargarRapidas]);

  useEffect(() => {
    if (!seleccion) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga del hilo al elegir una conversación
    void recargarChat(seleccion);
  }, [seleccion, recargarChat]);

  // Tiempo real: SuperSU ve todos los negocios (RLS). Cada evento refresca la bandeja y, si aplica, el hilo abierto.
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("soporte-admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "soporte_mensaje" }, (p) => {
        void recargarLista();
        const conv = (p.new as { conversacion_id?: string }).conversacion_id;
        if (conv && conv === seleccionRef.current) void recargarChat(conv);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "soporte_conversacion" }, () => void recargarLista())
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [recargarLista, recargarChat]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return lista.filter((c) => {
      if (filtro === "abiertas" && c.estado !== "ABIERTA") return false;
      if (filtro === "cerradas" && c.estado !== "CERRADA") return false;
      if (filtro === "sin_leer" && c.noLeidosAdmin === 0) return false;
      return !q || normalizar(`${c.negocioNombre ?? ""} ${c.ciudad ?? ""} ${c.ultimoMensajePreview ?? ""}`).includes(q);
    });
  }, [lista, filtro, busqueda]);

  const conteo = useMemo(
    () => ({ todos: lista.length, abiertas: lista.filter((c) => c.estado === "ABIERTA").length, cerradas: lista.filter((c) => c.estado === "CERRADA").length, sin_leer: lista.filter((c) => c.noLeidosAdmin > 0).length }),
    [lista],
  );

  const actual = chat && chat.conversacion.id === seleccion ? chat : null;
  const negocioId = actual?.conversacion.negocioId;

  const onEnviar = useCallback(
    async (cuerpo: string, adjunto: AdjuntoSubido | null) => {
      if (!negocioId || !seleccion) return "Selecciona una conversación.";
      const res = await enviarMensajeChatAdmin(negocioId, cuerpo, adjunto);
      if (!res.ok) return res.error;
      await Promise.all([recargarChat(seleccion), recargarLista()]);
      return null;
    },
    [negocioId, seleccion, recargarChat, recargarLista],
  );

  const prepararSubida = useCallback(async () => {
    if (!negocioId) return null;
    const res = await prepararAdjuntosChatAdmin(negocioId);
    return res.ok ? { conversacionId: res.data.conversacionId, negocioId } : null;
  }, [negocioId]);

  async function cambiarEstado(estado: "ABIERTA" | "CERRADA") {
    if (!seleccion) return;
    const res = await cambiarEstadoChatAdmin(seleccion, estado);
    if (!res.ok) return setError(res.error);
    await Promise.all([recargarChat(seleccion), recargarLista()]);
  }

  const rapidasActivas: RespuestaRapidaChat[] = rapidas.filter((r) => r.activo);
  const filtros: [Filtro, string][] = [["todos", "Todos"], ["abiertas", "Abiertas"], ["sin_leer", "Sin leer"], ["cerradas", "Cerradas"]];

  return (
    <div className={cn(s.raiz, s.marco)} style={{ padding: "clamp(8px,1.6vw,16px)" }}>
      {error ? (
        <p role="alert" className={s.error}>
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,330px)_minmax(0,1fr)_280px]" style={{ height: "min(78dvh, 780px)", minHeight: 520 }}>
        {/* Bandeja */}
        <section className={cn(s.tarjeta, seleccion && "max-lg:hidden")} aria-label="Conversaciones">
          <div style={{ padding: "14px 14px 8px" }}>
            <label className="relative block">
              <span className="sr-only">Buscar conversación</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 opacity-60" aria-hidden />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar negocio o ciudad…" className={s.campo} style={{ width: "100%", paddingLeft: 38, minHeight: 44, height: 44, borderRadius: 999 }} />
            </label>
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar conversaciones">
              {filtros.map(([k, et]) => (
                <button key={k} type="button" role="tab" aria-selected={filtro === k} className={cn(s.pestana, filtro === k && s.pestanaActiva)} style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} onClick={() => setFiltro(k)}>
                  {et} <span style={{ opacity: 0.7 }}>{conteo[k]}</span>
                </button>
              ))}
            </div>
          </div>
          <ul className="m-0 flex-1 list-none overflow-y-auto p-2.5" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibles.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm" style={{ color: "var(--nm-suave)" }}>
                {lista.length === 0 ? "Aún no hay conversaciones." : "No hay conversaciones que coincidan."}
              </li>
            ) : (
              visibles.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSeleccion(c.id)}
                    aria-current={c.id === seleccion}
                    className="w-full text-left"
                    style={{
                      border: 0,
                      cursor: "pointer",
                      padding: "12px 14px",
                      borderRadius: 20,
                      color: "var(--nm-texto)",
                      background: c.id === seleccion ? "var(--nm-bg)" : "var(--nm-card)",
                      boxShadow: c.id === seleccion ? "inset 3px 3px 8px var(--nm-sombra), inset -3px -3px 8px var(--nm-luz), inset 4px 0 0 var(--nm-azul-1)" : "4px 4px 10px var(--nm-sombra), -3px -3px 8px var(--nm-luz)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold">{c.negocioNombre ?? "Negocio"}</span>
                      {c.prioritario ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: "#fde7a8", color: "#7a4b00" }}>
                          <Star className="size-3" aria-hidden /> Prioritario
                        </span>
                      ) : null}
                      {c.noLeidosAdmin > 0 ? <span className={s.contador}>{c.noLeidosAdmin}</span> : null}
                    </span>
                    <span className="mt-1 block truncate text-[13px]" style={{ color: "var(--nm-suave)" }}>
                      {c.ultimoMensajePreview ?? "Sin mensajes"}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between text-[12px]" style={{ color: "var(--nm-suave)" }}>
                      <span>{[c.ciudad, c.plan ? PLAN[c.plan] : null].filter(Boolean).join(" · ")}</span>
                      <span>{horaCorta(c.ultimoMensajeAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Hilo */}
        <section className={cn(s.tarjeta, !seleccion && "max-lg:hidden")} aria-label="Conversación">
          {!actual ? (
            <div className={s.vacio} style={{ margin: "auto", padding: 24 }}>
              <p>{seleccion ? "Cargando conversación…" : "Elige una conversación de la bandeja para responder."}</p>
            </div>
          ) : (
            <>
              <header className={s.cabecera}>
                <span className="lg:hidden">
                  <button type="button" className={s.boton} onClick={() => setSeleccion(null)} aria-label="Volver a la bandeja">
                    <ArrowLeft className="size-5" aria-hidden />
                  </button>
                </span>
                <span className={s.avatarMarco}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar estático local */}
                  <img src={AVATAR_NEGOCIO} alt="" className={s.avatar} />
                </span>
                <div className="min-w-0">
                  <h2 className={s.titulo} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {actual.conversacion.negocioNombre ?? "Negocio"}
                  </h2>
                  <p className={s.subtitulo}>
                    {[actual.conversacion.ciudad, actual.conversacion.plan ? `Plan ${PLAN[actual.conversacion.plan] ?? actual.conversacion.plan}` : null].filter(Boolean).join(" · ")}
                    {actual.conversacion.prioritario ? " · Prioritario" : ""}
                  </p>
                </div>
                <span className={cn(s.estado, actual.conversacion.estado === "CERRADA" && s.estadoCerrada)}>{actual.conversacion.estado === "ABIERTA" ? "Abierta" : "Cerrada"}</span>
              </header>
              <HiloChat
                key={actual.conversacion.id}
                mensajes={actual.mensajes}
                miRol="SUPERSU"
                nombreOtro={actual.conversacion.negocioNombre ?? "Negocio"}
                avatarOtro={AVATAR_NEGOCIO}
                placeholder="Escribe una respuesta… (usa / para respuestas rápidas)"
                onEnviar={onEnviar}
                prepararSubida={prepararSubida}
                respuestasRapidas={rapidasActivas}
                onGestionarRespuestas={() => setGestionando(true)}
              />
            </>
          )}
        </section>

        {/* Detalles */}
        <aside className={cn(s.tarjeta, "max-xl:hidden")} aria-label="Detalles de la conversación" style={{ padding: 18, gap: 14, overflowY: "auto" }}>
          <h2 className="m-0 text-[17px] font-extrabold">Detalles</h2>
          {actual ? (
            <dl className="m-0 grid gap-3 text-[14px]">
              {[
                ["Estado", actual.conversacion.estado === "ABIERTA" ? "Abierta" : "Cerrada"],
                ["Plan", actual.conversacion.plan ? (PLAN[actual.conversacion.plan] ?? actual.conversacion.plan) : "—"],
                ["Prioridad", actual.conversacion.prioritario ? "Prioritario" : "Normal"],
                ["Ciudad", actual.conversacion.ciudad ?? "—"],
                ["Creada", hora(actual.conversacion.createdAt)],
                ["Último mensaje", actual.conversacion.ultimoMensajeAt ? hora(actual.conversacion.ultimoMensajeAt) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt style={{ color: "var(--nm-suave)" }}>{k}</dt>
                  <dd className="m-0 text-right font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="m-0 text-sm" style={{ color: "var(--nm-suave)" }}>
              Selecciona una conversación.
            </p>
          )}
          {actual ? (
            <div className="mt-auto flex flex-col gap-2.5">
              <Link href="/admin/negocios" className={s.chip} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}>
                <ExternalLink className="size-4" aria-hidden /> Ver en Negocios
              </Link>
              {actual.conversacion.estado === "ABIERTA" ? (
                <button type="button" className={s.chip} onClick={() => void cambiarEstado("CERRADA")}>
                  Cerrar conversación
                </button>
              ) : (
                <button type="button" className={cn(s.chip, s.enviar)} style={{ color: "#fff" }} onClick={() => void cambiarEstado("ABIERTA")}>
                  Reabrir conversación
                </button>
              )}
            </div>
          ) : null}
        </aside>
      </div>

      {gestionando ? <GestionRespuestas respuestas={rapidas} alCerrar={() => setGestionando(false)} alCambiar={cargarRapidas} /> : null}
    </div>
  );
}

/** Crear, editar y activar/desactivar las plantillas de respuesta rápida. */
function GestionRespuestas({ respuestas, alCerrar, alCambiar }: { respuestas: RespuestaRapida[]; alCerrar: () => void; alCambiar: () => Promise<void> }) {
  const vacio = { id: undefined as string | undefined, titulo: "", atajo: "/", cuerpo: "", activo: true };
  const [edicion, setEdicion] = useState(vacio);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [alCerrar]);

  async function guardar(datos: typeof vacio) {
    setGuardando(true);
    setError(null);
    const res = await guardarRespuestaRapida(datos);
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    await alCambiar();
    setEdicion(vacio);
  }

  return (
    <div className={s.visor} role="dialog" aria-modal="true" aria-label="Gestionar respuestas rápidas" onClick={alCerrar}>
      <div className={cn(s.raiz, s.tarjeta)} style={{ width: "min(760px, 100%)", maxHeight: "90dvh", padding: 18, gap: 12, overflowY: "auto", background: "var(--nm-card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[18px] font-extrabold">Respuestas rápidas</h2>
          <button type="button" className={s.boton} style={{ width: 40, height: 40 }} onClick={alCerrar} aria-label="Cerrar">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {respuestas.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--nm-bg)", opacity: r.activo ? 1 : 0.55 }}>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] font-extrabold">
                  <span className={s.atajo}>{r.atajo}</span> · {r.titulo}
                </p>
                <p className="m-0 truncate text-[13px]" style={{ color: "var(--nm-suave)" }}>
                  {r.cuerpo}
                </p>
              </div>
              <button type="button" className={s.chip} style={{ minHeight: 38 }} onClick={() => setEdicion({ id: r.id, titulo: r.titulo, atajo: r.atajo, cuerpo: r.cuerpo, activo: r.activo })}>
                Editar
              </button>
              <button type="button" className={s.chip} style={{ minHeight: 38 }} onClick={() => void guardar({ id: r.id, titulo: r.titulo, atajo: r.atajo, cuerpo: r.cuerpo, activo: !r.activo })}>
                {r.activo ? "Desactivar" : "Activar"}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar(edicion);
          }}
        >
          <h3 className="m-0 text-[15px] font-extrabold">{edicion.id ? "Editar respuesta" : "Nueva respuesta"}</h3>
          <div className="grid gap-2.5 sm:grid-cols-[1fr_180px]">
            <input aria-label="Título" placeholder="Título" maxLength={60} value={edicion.titulo} onChange={(e) => setEdicion({ ...edicion, titulo: e.target.value })} className={s.campo} style={{ minHeight: 46, height: 46, borderRadius: 16 }} />
            <input aria-label="Atajo" placeholder="/atajo" maxLength={21} value={edicion.atajo} onChange={(e) => setEdicion({ ...edicion, atajo: e.target.value })} className={s.campo} style={{ minHeight: 46, height: 46, borderRadius: 16 }} />
          </div>
          <textarea aria-label="Texto de la respuesta" placeholder="Texto de la respuesta" maxLength={1000} rows={4} value={edicion.cuerpo} onChange={(e) => setEdicion({ ...edicion, cuerpo: e.target.value })} className={s.campo} style={{ borderRadius: 16 }} />
          {error ? (
            <p role="alert" className={s.error} style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}
          <div className="flex gap-2.5">
            <button type="submit" disabled={guardando} className={cn(s.chip, s.enviar)} style={{ color: "#fff" }}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            {edicion.id ? (
              <button type="button" className={s.chip} onClick={() => setEdicion(vacio)}>
                Cancelar edición
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
