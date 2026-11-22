import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { Caja, Insignia, TituloCaja } from "@/app/admin/_componentes/ui-admin";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { detalleCaso, evidenciasCaso } from "../actions";
import { ETIQUETA_ESTADO, ETIQUETA_ORIGEN, TONO_PRIORIDAD, formatoFecha } from "../presentacion";
import { AccionesCaso, BotonAdjunto } from "./acciones-caso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Caso · Centro de Cumplimiento" };

type Detalle = {
  ticket: Record<string, string | boolean | null>;
  tipo: { nombre: string; categoria: string; requiere_revision_juridica: boolean } | null;
  regla: { norma: string | null; articulo: string | null; fuente_url: string | null; plazo: number | null; unidad: string; estado_verificacion: string; prorroga_max: number | null; observaciones: string | null } | null;
  solicitante: { nombre: string; email: string; telefono: string | null; id_tipo: string | null; id_numero: string | null } | null;
  responsable: string | null;
  mensajes: { id: string; actor_tipo: string; mensaje: string; tipo: string; sustantiva: boolean; created_at: string }[];
  historial: { id: number; tipo_evento: string; estado_origen: string | null; estado_destino: string | null; actor_tipo: string; detalle: Record<string, unknown>; created_at: string }[];
  adjuntos: { id: string; nombre: string; mime: string; bytes: number; sha256: string; subido_por_tipo: string; at: string }[];
  notificaciones: { canal: string; regla: string; estado: string; destinatario_tipo: string; intentos: number; error: string | null; at: string }[];
};

export default async function CasoPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [r, ev] = await Promise.all([detalleCaso(id), evidenciasCaso(id)]);
  if (!r.ok || !r.data) notFound();
  const d = r.data as unknown as Detalle;
  const t = d.ticket;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <Link href="/admin/centro-cumplimiento" className="font-mono text-xs underline">← Centro de cumplimiento</Link>
      <EncabezadoAdmin seccion="Cumplimiento" titulo={String(t.numero_radicacion)} descripcion={String(t.asunto)} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Caja className="lg:col-span-2">
          <TituloCaja>Resumen</TituloCaja>
          <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-text-muted">Tipo</dt><dd>{d.tipo?.nombre} {d.tipo?.requiere_revision_juridica ? <Insignia tono="alerta">Revisión jurídica pendiente</Insignia> : null}</dd></div>
            <div><dt className="text-text-muted">Estado</dt><dd className="font-bold">{ETIQUETA_ESTADO[String(t.estado_caso)] ?? String(t.estado_caso)}</dd></div>
            <div><dt className="text-text-muted">Prioridad</dt><dd><Insignia tono={TONO_PRIORIDAD[String(t.prioridad)] ?? "neutro"}>{String(t.prioridad)}</Insignia></dd></div>
            <div><dt className="text-text-muted">Responsable</dt><dd>{d.responsable ?? <Insignia tono="alerta">Sin asignar</Insignia>}</dd></div>
            <div><dt className="text-text-muted">Radicado</dt><dd>{formatoFecha(String(t.recibido_at))} · {String(t.canal)}</dd></div>
            <div><dt className="text-text-muted">Fecha límite</dt><dd>{formatoFecha(t.fecha_limite as string | null)}{t.prorroga_aplicada ? " (ampliada)" : ""}<br /><span className="text-[11px] text-text-muted">{ETIQUETA_ORIGEN[String(t.plazo_origen)] ?? ""}</span></dd></div>
            <div><dt className="text-text-muted">Respuesta de fondo</dt><dd>{formatoFecha(t.respondido_at as string | null)}</dd></div>
            <div><dt className="text-text-muted">Resuelto / cerrado</dt><dd>{formatoFecha(t.resuelto_at as string | null)} / {formatoFecha(t.cerrado_at as string | null)}</dd></div>
            {t.reclamo_en_tramite_desde ? <div className="sm:col-span-2"><Insignia tono="acento">Reclamo en trámite desde {formatoFecha(String(t.reclamo_en_tramite_desde))}</Insignia></div> : null}
          </dl>
          {d.regla ? (
            <p className="border-t border-border p-4 text-xs leading-5 text-text-muted">
              <strong className="text-text">Fundamento del plazo:</strong> {d.regla.norma ?? "sin norma cargada"} {d.regla.articulo ?? ""} · {d.regla.plazo ?? "—"} {d.regla.unidad.replaceAll("_", " ").toLowerCase()} ·{" "}
              <strong>{d.regla.estado_verificacion.replaceAll("_", " ").toLowerCase()}</strong>
              {d.regla.fuente_url ? <> · <a className="underline" href={d.regla.fuente_url} target="_blank" rel="noopener noreferrer">fuente</a></> : null}
              {d.regla.observaciones ? <><br />{d.regla.observaciones}</> : null}
            </p>
          ) : null}
        </Caja>

        <Caja>
          <TituloCaja>Solicitante</TituloCaja>
          <div className="space-y-1 p-4 text-sm">
            {d.solicitante ? (<>
              <p className="font-bold">{d.solicitante.nombre}</p>
              <p>{d.solicitante.email}</p>
              {d.solicitante.telefono ? <p>{d.solicitante.telefono}</p> : null}
              {d.solicitante.id_numero ? <p className="text-text-muted">{d.solicitante.id_tipo} {d.solicitante.id_numero}</p> : <p className="text-text-muted">Sin documento (no era necesario para este tipo)</p>}
            </>) : <p className="text-text-muted">Caso creado desde una cuenta de la plataforma.</p>}
          </div>
        </Caja>
      </div>

      <AccionesCaso id={id} miId={user?.id ?? ""} estado={String(t.estado_caso)} critico={t.prioridad === "CRITICA"} sinProrroga={!(d.regla?.prorroga_max)} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Caja>
          <TituloCaja>Conversación</TituloCaja>
          <ul className="space-y-2 p-4 text-sm">
            {d.mensajes.map((m) => (
              <li key={m.id} className={`border-2 p-2 ${m.tipo === "NOTA_INTERNA" ? "border-dashed border-warning bg-warning/10" : "border-border"}`}>
                <p className="font-mono text-[11px] uppercase text-text-muted">{m.tipo === "NOTA_INTERNA" ? "Nota interna (no la ve el solicitante)" : m.actor_tipo}{m.sustantiva ? " · respuesta de fondo" : ""} · {formatoFecha(m.created_at)}</p>
                <p className="mt-1 whitespace-pre-line">{m.mensaje}</p>
              </li>
            ))}
          </ul>
        </Caja>
        <Caja>
          <TituloCaja>Historial</TituloCaja>
          <ol className="space-y-1 p-4 text-xs">
            {d.historial.map((h) => (
              <li key={h.id}>{formatoFecha(h.created_at)} · <strong>{h.tipo_evento.replaceAll("_", " ").toLowerCase()}</strong> {h.estado_origen ? `${h.estado_origen} → ` : ""}{h.estado_destino ?? ""} <span className="text-text-muted">({h.actor_tipo.toLowerCase()})</span></li>
            ))}
          </ol>
        </Caja>
        <Caja>
          <TituloCaja>Adjuntos</TituloCaja>
          <ul className="space-y-1 p-4 text-sm">
            {d.adjuntos.length === 0 ? <li className="text-text-muted">Sin adjuntos.</li> : d.adjuntos.map((a) => (
              <li key={a.id}><BotonAdjunto id={a.id} nombre={a.nombre} /> <span className="text-xs text-text-muted">{a.mime} · {Math.round(a.bytes / 1024)} KB · sha256 {a.sha256.slice(0, 12)}…</span></li>
            ))}
            <li className="text-[11px] text-text-muted">Sin antivirus: ábrelos con cuidado. Cada descarga queda auditada.</li>
          </ul>
        </Caja>
        <Caja>
          <TituloCaja>Notificaciones</TituloCaja>
          <ul className="space-y-1 p-4 text-xs">
            {d.notificaciones.map((n, i) => (
              <li key={i}>{formatoFecha(n.at)} · {n.canal} · {n.regla.replaceAll("_", " ").toLowerCase()} · <strong>{n.estado.replaceAll("_", " ").toLowerCase()}</strong>{n.error ? ` (${n.error})` : ""}{n.intentos > 1 ? ` · ${n.intentos} intentos` : ""}</li>
            ))}
          </ul>
        </Caja>
        <Caja className="lg:col-span-2">
          <TituloCaja>Evidencias (repositorio con hash encadenado)</TituloCaja>
          <ul className="space-y-1 p-4 text-xs">
            {ev.ok ? ev.data.map((e) => (
              <li key={e.secuencia}>#{e.secuencia} · {formatoFecha(e.ocurrido_at)} · {e.finalidad} · <span className="font-mono">{e.hash.slice(0, 16)}…</span></li>
            )) : <li className="text-danger">{ev.error}</li>}
          </ul>
        </Caja>
      </div>
    </main>
  );
}
