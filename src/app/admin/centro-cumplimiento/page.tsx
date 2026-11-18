import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { Caja, Insignia, Kpi, TituloCaja, Vacio } from "@/app/admin/_componentes/ui-admin";
import { AlertTriangle, Clock, Inbox, ShieldAlert, UserX, CheckCircle2, MessageSquareReply, Search } from "lucide-react";
import Link from "next/link";
import { alertasCrm, cargarDashboard, leerConfiguracion, listarCasos, type Dashboard } from "./actions";
import { PanelConfiguracion } from "./panel-configuracion";
import { ETIQUETA_ESTADO, ETIQUETA_ORIGEN, TONO_PRIORIDAD, formatoFecha, restante } from "./presentacion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Centro de Cumplimiento y PQRS" };

const BANDEJAS = [
  ["TODOS", "Todos"], ["SIN_ASIGNAR", "Sin asignar"], ["CRITICOS", "Críticos"], ["PROXIMOS", "Próximos a vencer"], ["VENCIDOS", "Vencidos"],
  ["DATOS", "Datos personales"], ["CONSUMIDOR", "Consumidor"], ["PQRS", "PQRS"], ["INCIDENTES", "Incidentes"], ["RESUELTOS", "Resueltos"], ["CERRADOS", "Cerrados"],
] as const;
const FILTROS = ["tipo", "estado", "prioridad", "canal", "numero", "responsable", "negocio", "usuario", "desde", "hasta"] as const;

const n = (d: Dashboard | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : 0);

export default async function CentroCumplimientoPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const un = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const bandeja = BANDEJAS.some(([k]) => k === un("b")) ? un("b") : "TODOS";
  const filtros = Object.fromEntries(FILTROS.map((k) => [k, un(k)]).filter(([, v]) => v));

  const [dash, lista, alertas, config] = await Promise.all([cargarDashboard(), listarCasos(bandeja, filtros), alertasCrm(), leerConfiguracion()]);
  const d = dash.ok ? dash.data : undefined;
  const filas = lista.ok ? lista.data : [];
  const sms = d?.sms as { habilitado: boolean; pendientes_por_deshabilitado: number } | undefined;

  return (
    <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Cumplimiento"
        titulo="Centro de cumplimiento"
        resaltado="y PQRS."
        descripcion="Solicitudes, reclamos, consultas de datos personales e incidentes, con su plazo, responsable y evidencia. Los plazos marcados como provisionales o internos NO son obligaciones legales confirmadas."
        acciones={<Link href="/solicitudes" className="border-2 border-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-text hover:text-bg">Ver formulario público</Link>}
      />

      {!dash.ok ? <p role="alert" className="mb-4 border-2 border-danger p-3 text-sm text-danger">{dash.error}</p> : null}
      {sms && !sms.habilitado ? (
        <p className="mb-4 border-2 border-warning bg-warning/20 p-3 text-sm">
          <strong>SMS deshabilitado:</strong> aún no hay proveedor ni credenciales. Las alertas críticas llegan por correo y por este Centro
          {sms.pendientes_por_deshabilitado > 0 ? ` (${sms.pendientes_por_deshabilitado} alerta(s) SMS quedaron registradas como «canal no habilitado»; no se enviaron)` : ""}.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icono={Inbox} etiqueta="Abiertos" valor={String(n(d, "abiertos"))} href="/admin/centro-cumplimiento?b=TODOS" />
        <Kpi icono={UserX} etiqueta="Sin asignar" valor={String(n(d, "sin_asignar"))} href="/admin/centro-cumplimiento?b=SIN_ASIGNAR" destacada={n(d, "sin_asignar") > 0} />
        <Kpi icono={ShieldAlert} etiqueta="Críticos" valor={String(n(d, "criticos"))} href="/admin/centro-cumplimiento?b=CRITICOS" destacada={n(d, "criticos") > 0} />
        <Kpi icono={Clock} etiqueta="Próximos a vencer (72 h)" valor={String(n(d, "proximos_vencer"))} href="/admin/centro-cumplimiento?b=PROXIMOS" />
        <Kpi icono={AlertTriangle} etiqueta="Vencidos" valor={String(n(d, "vencidos"))} href="/admin/centro-cumplimiento?b=VENCIDOS" destacada={n(d, "vencidos") > 0} />
        <Kpi icono={MessageSquareReply} etiqueta="Pendientes de respuesta" valor={String(n(d, "pendientes_respuesta"))} />
        <Kpi icono={Search} etiqueta="En investigación" valor={String(n(d, "en_investigacion"))} nota={`${n(d, "esperando_solicitante")} esperando al solicitante`} />
        <Kpi icono={CheckCircle2} etiqueta="Por resolver / cerrar" valor={`${n(d, "pendientes_resolucion")} / ${n(d, "pendientes_cierre")}`} />
      </div>

      <nav aria-label="Bandejas" className="mt-6 flex flex-wrap gap-1.5">
        {BANDEJAS.map(([k, et]) => (
          <Link key={k} href={`/admin/centro-cumplimiento?b=${k}`}
            className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase ${bandeja === k ? "border-text bg-text text-bg" : "border-border hover:bg-surface"}`}>
            {et}
          </Link>
        ))}
      </nav>

      <form method="get" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <input type="hidden" name="b" value={bandeja} />
        <input name="numero" defaultValue={un("numero")} placeholder="N.º SN-2026-000123" className="min-h-10 border-2 border-border bg-bg px-2 text-sm" />
        <select name="prioridad" defaultValue={un("prioridad")} className="min-h-10 border-2 border-border bg-bg px-2 text-sm">
          <option value="">Prioridad</option><option value="CRITICA">Crítica</option><option value="ALTA">Alta</option><option value="NORMAL">Normal</option><option value="BAJA">Baja</option>
        </select>
        <select name="estado" defaultValue={un("estado")} className="min-h-10 border-2 border-border bg-bg px-2 text-sm">
          <option value="">Estado</option>
          {Object.entries(ETIQUETA_ESTADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="canal" defaultValue={un("canal")} className="min-h-10 border-2 border-border bg-bg px-2 text-sm">
          <option value="">Canal</option><option value="WEB_PUBLICO">Web público</option><option value="PLATAFORMA">Plataforma</option><option value="CORREO">Correo</option><option value="TELEFONO">Teléfono</option><option value="AUTORIDAD">Autoridad</option><option value="INTERNO">Interno</option>
        </select>
        <input name="desde" type="date" defaultValue={un("desde")} aria-label="Desde" className="min-h-10 border-2 border-border bg-bg px-2 text-sm" />
        <button type="submit" className="min-h-10 border-2 border-ink bg-signal px-3 font-mono text-xs font-bold uppercase">Filtrar</button>
      </form>

      <Caja className="mt-4">
        <TituloCaja extra={<span className="font-mono text-xs text-text-muted">{filas[0]?.total ?? 0} casos</span>}>Casos</TituloCaja>
        <div className="overflow-x-auto p-2 sm:p-4">
          {filas.length === 0 ? <Vacio>No hay casos en esta bandeja.</Vacio> : (
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="font-mono text-[11px] uppercase text-text-muted">
                <tr><th className="p-2">Caso</th><th className="p-2">Tipo</th><th className="p-2">Prioridad</th><th className="p-2">Estado</th><th className="p-2">Responsable</th><th className="p-2">Vence</th></tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c.id} className="border-t border-border align-top">
                    <td className="p-2"><Link className="font-mono font-bold underline" href={`/admin/centro-cumplimiento/${c.id}`}>{c.numero}</Link><br /><span className="text-text-muted">{c.asunto.slice(0, 60)}</span></td>
                    <td className="p-2">{c.tipo_nombre}<br /><span className="text-[11px] text-text-muted">{c.canal}</span></td>
                    <td className="p-2"><Insignia tono={TONO_PRIORIDAD[c.prioridad] ?? "neutro"}>{c.prioridad}</Insignia></td>
                    <td className="p-2">{ETIQUETA_ESTADO[c.estado_caso] ?? c.estado_caso}</td>
                    <td className="p-2">{c.responsable ?? <Insignia tono="alerta">Sin asignar</Insignia>}</td>
                    <td className="p-2">{formatoFecha(c.fecha_limite)}<br />
                      <span className={c.vencido ? "font-bold text-danger" : "text-text-muted"}>{restante(c.horas_restantes, c.vencido)}</span><br />
                      <span className="text-[11px] text-text-muted">{ETIQUETA_ORIGEN[c.plazo_origen ?? ""] ?? ""}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Caja>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Caja>
          <TituloCaja>Alertas del CRM</TituloCaja>
          <ul className="space-y-1 p-4 text-sm">
            {alertas.ok && alertas.data.length > 0 ? alertas.data.map((a) => (
              <li key={a.id} className={a.leida ? "text-text-muted" : "font-bold"}>
                <Link className="underline" href={`/admin/centro-cumplimiento/${a.ticket_id}`}>{a.numero}</Link> · {a.regla.replaceAll("_", " ").toLowerCase()} · {a.prioridad} · {formatoFecha(a.created_at)}
              </li>
            )) : <li className="text-text-muted">Sin alertas.</li>}
          </ul>
        </Caja>
        <Caja>
          <TituloCaja>Destinatarios y SMS</TituloCaja>
          {config.ok ? <PanelConfiguracion config={config.data} /> : <p className="p-4 text-sm text-danger">{config.error}</p>}
        </Caja>
      </div>
    </main>
  );
}
