import { FormAccion } from "@/components/ganancias/form-accion";
import { Badge } from "@/components/ui/card";
import { ETIQUETA_LIQUIDACION, type Capacidades, type Liquidacion } from "@/lib/ganancias/tipos";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import {
  ajustarComision, anularPago, autorizarSoporte, cerrarLiquidacion, crearRegla, definirPermiso, desactivarRegla, detectarNovedades,
  gestionarNovedad, quitarPermiso, registrarPago, responderRevision, revertirLiquidacion, revocarSoporte, solicitarSoporte,
} from "./actions";

const CAMPO = "min-h-10 w-full border-2 border-border bg-bg px-2 text-[13px] text-text";
const ETQ = "text-[11px] font-bold uppercase text-text-muted";

export interface Opcion { id: string; nombre: string }

function fecha(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" });
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 border-2 border-border bg-surface p-4">
      <h2 className="mb-3 text-[14px] font-bold uppercase text-text">{titulo}</h2>
      {children}
    </section>
  );
}

// ── Liquidaciones ──────────────────────────────────────────────────────────────
export interface PagoFila { id: string; liquidacion_id: string; monto: number; medio: string; referencia: string | null; estado: string; pagado_el: string }

export function PestanaLiquidaciones({
  liquidaciones, pagos, equipo, sedes, caps,
}: { liquidaciones: Liquidacion[]; pagos: PagoFila[]; equipo: Opcion[]; sedes: Opcion[]; caps: Capacidades }) {
  return (
    <>
      {caps.liquidar ? (
        <Seccion titulo="Cerrar una liquidación">
          <p className="mb-3 text-[12.5px] text-text-muted">Toma las comisiones pendientes del profesional en el período, más sus ajustes pendientes. Un cierre no se edita: se corrige con ajustes o revirtiéndolo.</p>
          <FormAccion accion={cerrarLiquidacion} etiqueta="Cerrar liquidación" confirmacion="¿Cerrar esta liquidación? Las comisiones incluidas quedarán marcadas como liquidadas." exito="Liquidación cerrada." className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <label className={ETQ}>Profesional<select name="staff" required className={CAMPO}>{equipo.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>
            <label className={ETQ}>Tipo<select name="tipo" className={CAMPO}><option value="SEMANAL">Semanal</option><option value="DIARIO">Diario</option><option value="QUINCENAL">Quincenal</option><option value="MENSUAL">Mensual</option><option value="PERSONALIZADO">Personalizado</option></select></label>
            <label className={ETQ}>Desde<input type="date" name="desde" required className={CAMPO} /></label>
            <label className={ETQ}>Hasta<input type="date" name="hasta" required className={CAMPO} /></label>
            <label className={ETQ}>Sede (opcional)<select name="sede" className={CAMPO}><option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
          </FormAccion>
          <details className="mt-4">
            <summary className="cursor-pointer text-[12.5px] font-semibold underline">Registrar un ajuste (+/−) para la próxima liquidación</summary>
            <FormAccion accion={ajustarComision} etiqueta="Registrar ajuste" confirmacion="¿Registrar este ajuste? Quedará auditado y se incluirá en la próxima liquidación." className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
              <label className={ETQ}>Profesional<select name="staff" required className={CAMPO}>{equipo.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>
              <label className={ETQ}>Monto (negativo descuenta)<input type="number" name="monto" step="0.01" required className={CAMPO} /></label>
              <label className={`${ETQ} col-span-2 md:col-span-3`}>Motivo (mín. 10 caracteres)<input name="motivo" required minLength={10} maxLength={500} className={CAMPO} /></label>
            </FormAccion>
          </details>
        </Seccion>
      ) : null}
      <Seccion titulo="Liquidaciones">
        {liquidaciones.length === 0 ? <p className="text-[13px] text-text-muted">Aún no hay liquidaciones.</p> : (
          <ul className="grid gap-3">
            {liquidaciones.map((l) => {
              const susPagos = pagos.filter((p) => p.liquidacion_id === l.id);
              return (
                <li key={l.id} className="border-2 border-border bg-bg p-3 text-[12.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-text">#{l.numero} · {l.staff_nombre ?? "Profesional"} · {fecha(l.desde)} – {fecha(l.hasta)}</p>
                    <Badge tone={l.estado === "PAGADA" ? "success" : l.estado === "REVERTIDA" ? "neutral" : "accent"}>{ETIQUETA_LIQUIDACION[l.estado] ?? l.estado}</Badge>
                  </div>
                  <p className="mt-1 text-text-muted">{l.servicios} servicios · producción {formatCOP(l.produccion)} · comisiones {formatCOP(l.total_comisiones)} · ajustes {formatCOP(l.total_ajustes)}</p>
                  <p className="mt-1">Total <b>{formatCOP(l.total_neto)}</b> · pagado {formatCOP(l.pagado)} · saldo <b>{formatCOP(l.saldo)}</b></p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link href={`/panel/ganancias/liquidacion/${l.id}`} className="font-semibold underline">Comprobante</Link>
                  </div>
                  {susPagos.length > 0 ? (
                    <ul className="mt-2 grid gap-1 border-t border-border-subtle pt-2">
                      {susPagos.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span className={p.estado === "ANULADO" ? "line-through text-text-muted" : ""}>{fecha(p.pagado_el)} · {formatCOP(p.monto)} · {p.medio}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                          {caps.pagar && p.estado === "REGISTRADO" ? (
                            <FormAccion accion={anularPago} etiqueta="Anular pago" variante="ghost" confirmacion="¿Anular este pago? Quedará auditado." className="flex items-center gap-2">
                              <input type="hidden" name="pago" value={p.id} />
                              <input name="motivo" required minLength={10} placeholder="Motivo (mín. 10)" className={`${CAMPO} max-w-56`} />
                            </FormAccion>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {caps.pagar && (l.estado === "CERRADA" || l.estado === "PAGADA_PARCIAL") ? (
                    <FormAccion accion={registrarPago} etiqueta="Registrar pago" confirmacion="¿Registrar este pago? Solo deja constancia: StylerNow no mueve dinero." exito="Pago registrado." className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <input type="hidden" name="liquidacion" value={l.id} />
                      <input type="hidden" name="clave" value={`${l.id}:${l.pagado}`} />
                      <label className={ETQ}>Monto<input type="number" name="monto" min="1" max={l.saldo} step="0.01" defaultValue={l.saldo} required className={CAMPO} /></label>
                      <label className={ETQ}>Medio<select name="medio" className={CAMPO}><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="NEQUI">Nequi</option><option value="DAVIPLATA">Daviplata</option><option value="OTRO">Otro</option></select></label>
                      <label className={ETQ}>Fecha<input type="date" name="fecha" className={CAMPO} /></label>
                      <label className={ETQ}>Referencia<input name="referencia" maxLength={120} className={CAMPO} /></label>
                    </FormAccion>
                  ) : null}
                  {caps.liquidar && l.estado !== "REVERTIDA" && l.pagado === 0 ? (
                    <FormAccion accion={revertirLiquidacion} etiqueta="Revertir liquidación" variante="ghost" confirmacion="¿Revertir esta liquidación? Las comisiones vuelven a quedar pendientes." className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="liquidacion" value={l.id} />
                      <input name="motivo" required minLength={10} placeholder="Motivo (mín. 10)" className={`${CAMPO} max-w-72`} />
                    </FormAccion>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Seccion>
    </>
  );
}

// ── Reglas ────────────────────────────────────────────────────────────────────
export interface ReglaFila { id: string; sede_id: string | null; staff_id: string | null; servicio_id: string | null; categoria: string | null; pct: number; base: string; vigente_desde: string; vigente_hasta: string | null; estado: string; version: number; motivo: string; created_at: string }

export function PestanaReglas({ reglas, equipo, sedes, servicios, caps }: { reglas: ReglaFila[]; equipo: Opcion[]; sedes: Opcion[]; servicios: Opcion[]; caps: Capacidades }) {
  const nombre = (lista: Opcion[], id: string | null, vacio: string) => (id ? lista.find((x) => x.id === id)?.nombre ?? "—" : vacio);
  return (
    <>
      <Seccion titulo="Cómo se elige la regla">
        <p className="text-[12.5px] text-text-muted">Gana la regla más específica: profesional + servicio, luego profesional + categoría, profesional, servicio, categoría, sede y por último la general del negocio. Sin regla se usa la comisión base del profesional; si tampoco existe, el servicio queda «Sin regla» y se genera una novedad. Cambiar una regla no altera comisiones ya generadas.</p>
      </Seccion>
      {caps.configurar ? (
        <Seccion titulo="Nueva regla o nueva versión">
          <FormAccion accion={crearRegla} etiqueta="Guardar regla" confirmacion="¿Guardar esta regla? Aplica a los servicios que se completen desde su fecha de inicio." exito="Regla guardada." className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <label className={ETQ}>Porcentaje<input type="number" name="pct" min="0" max="100" step="0.01" required className={CAMPO} /></label>
            <label className={ETQ}>Base<select name="base" className={CAMPO}><option value="NETO">Valor neto (después de descuento)</option><option value="PRECIO_ORIGINAL">Precio original</option></select></label>
            <label className={ETQ}>Profesional<select name="staff" className={CAMPO}><option value="">Todos</option>{equipo.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>
            <label className={ETQ}>Servicio<select name="servicio" className={CAMPO}><option value="">Todos</option>{servicios.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>
            <label className={ETQ}>Categoría (si no eliges servicio)<input name="categoria" maxLength={40} className={CAMPO} /></label>
            <label className={ETQ}>Sede<select name="sede" className={CAMPO}><option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
            <label className={ETQ}>Vigente desde<input type="date" name="desde" className={CAMPO} /></label>
            <label className={ETQ}>Hasta (opcional)<input type="date" name="hasta" className={CAMPO} /></label>
            <label className={`${ETQ} col-span-2 md:col-span-3`}>Motivo<input name="motivo" required minLength={3} maxLength={500} className={CAMPO} /></label>
            <label className={ETQ}>Reemplaza regla<select name="reemplaza" className={CAMPO}><option value="">Ninguna (nueva)</option>{reglas.filter((r) => r.estado === "ACTIVA").map((r) => <option key={r.id} value={r.id}>{r.pct}% · {nombre(servicios, r.servicio_id, "todos")} · v{r.version}</option>)}</select></label>
          </FormAccion>
        </Seccion>
      ) : null}
      <Seccion titulo="Reglas">
        {reglas.length === 0 ? <p className="text-[13px] text-text-muted">No hay reglas. Se usa la comisión base de cada profesional.</p> : (
          <ul className="grid gap-2">
            {reglas.map((r) => (
              <li key={r.id} className="border-2 border-border bg-bg p-3 text-[12.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{r.pct}% sobre {r.base === "NETO" ? "valor neto" : "precio original"} · v{r.version}</p>
                  <Badge tone={r.estado === "ACTIVA" ? "success" : "neutral"}>{r.estado === "ACTIVA" ? "Activa" : "Inactiva"}</Badge>
                </div>
                <p className="mt-1 text-text-muted">
                  {nombre(equipo, r.staff_id, "Todos los profesionales")} · {r.servicio_id ? nombre(servicios, r.servicio_id, "") : r.categoria ?? "Todos los servicios"} · {nombre(sedes, r.sede_id, "Todas las sedes")} · desde {fecha(r.vigente_desde)}{r.vigente_hasta ? ` hasta ${fecha(r.vigente_hasta)}` : ""}
                </p>
                <p className="text-text-muted">Motivo: {r.motivo}</p>
                {caps.configurar && r.estado === "ACTIVA" ? (
                  <FormAccion accion={desactivarRegla} etiqueta="Desactivar" variante="ghost" confirmacion="¿Desactivar esta regla? Los nuevos servicios dejarán de usarla." className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="regla" value={r.id} />
                    <input name="motivo" required minLength={3} placeholder="Motivo" className={`${CAMPO} max-w-72`} />
                  </FormAccion>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </>
  );
}

// ── Novedades ─────────────────────────────────────────────────────────────────
export interface NovedadFila { id: string; tipo: string; severidad: string; estado: string; descripcion: string; impacto: number | null; created_at: string; resolucion: string | null; reserva_id: string | null }
const TONO_SEV: Record<string, "success" | "danger" | "accent" | "neutral"> = { CRITICA: "danger", ALTA: "danger", MEDIA: "accent", BAJA: "neutral", INFORMATIVA: "neutral" };

export function PestanaNovedades({ novedades }: { novedades: NovedadFila[] }) {
  return (
    <Seccion titulo="Novedades financieras">
      <FormAccion accion={detectarNovedades} etiqueta="Buscar novedades ahora" exito="Búsqueda terminada." className="mb-3" />
      {novedades.length === 0 ? <p className="text-[13px] text-text-muted">Sin novedades.</p> : (
        <ul className="grid gap-2">
          {novedades.map((n) => (
            <li key={n.id} className="border-2 border-border bg-bg p-3 text-[12.5px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{n.tipo.replaceAll("_", " ").toLowerCase()}</p>
                <span className="flex gap-1.5"><Badge tone={TONO_SEV[n.severidad] ?? "neutral"}>{n.severidad.toLowerCase()}</Badge><Badge tone={n.estado === "RESUELTA" ? "success" : "neutral"}>{n.estado.toLowerCase().replace("_", " ")}</Badge></span>
              </div>
              <p className="mt-1">{n.descripcion}</p>
              <p className="text-text-muted">{fecha(n.created_at)}{n.impacto != null ? ` · impacto ${formatCOP(n.impacto)}` : ""}{n.resolucion ? ` · ${n.resolucion}` : ""}</p>
              {n.estado !== "RESUELTA" && n.estado !== "DESCARTADA" ? (
                <FormAccion accion={gestionarNovedad} etiqueta="Guardar" className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <input type="hidden" name="novedad" value={n.id} />
                  <label className={ETQ}>Estado<select name="estado" className={CAMPO}><option value="EN_REVISION">En revisión</option><option value="PENDIENTE">Pendiente</option><option value="RESUELTA">Resuelta</option><option value="DESCARTADA">Descartada</option></select></label>
                  <label className={`${ETQ} md:col-span-2`}>Solución o justificación (mín. 10 si resuelves o descartas)<input name="resolucion" maxLength={500} className={CAMPO} /></label>
                </FormAccion>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}

// ── Revisiones ────────────────────────────────────────────────────────────────
export interface RevisionFila { id: string; staff_id: string; objeto_tipo: string; objeto_id: string; motivo: string; estado: string; respuesta: string | null; created_at: string }

export function PestanaRevisiones({ revisiones, equipo }: { revisiones: RevisionFila[]; equipo: Opcion[] }) {
  return (
    <Seccion titulo="Solicitudes de revisión de los profesionales">
      <p className="mb-3 text-[12.5px] text-text-muted">Una solicitud no cambia ningún valor. Si apruebas, corrige con un ajuste en Liquidaciones.</p>
      {revisiones.length === 0 ? <p className="text-[13px] text-text-muted">Sin solicitudes.</p> : (
        <ul className="grid gap-2">
          {revisiones.map((r) => (
            <li key={r.id} className="border-2 border-border bg-bg p-3 text-[12.5px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{equipo.find((e) => e.id === r.staff_id)?.nombre ?? "Profesional"} · {r.objeto_tipo.toLowerCase()}</p>
                <Badge tone={r.estado === "APROBADA" ? "success" : r.estado === "RECHAZADA" ? "danger" : "accent"}>{r.estado.toLowerCase().replaceAll("_", " ")}</Badge>
              </div>
              <p className="mt-1">{r.motivo}</p>
              <p className="text-text-muted">{fecha(r.created_at)}{r.respuesta ? ` · Respuesta: ${r.respuesta}` : ""}</p>
              {r.estado === "SOLICITADA" || r.estado === "EN_REVISION" || r.estado === "EVIDENCIA_SOLICITADA" ? (
                <FormAccion accion={responderRevision} etiqueta="Responder" className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <input type="hidden" name="revision" value={r.id} />
                  <label className={ETQ}>Decisión<select name="estado" className={CAMPO}><option value="EN_REVISION">En revisión</option><option value="EVIDENCIA_SOLICITADA">Pedir evidencia</option><option value="APROBADA">Aprobar</option><option value="RECHAZADA">Rechazar</option></select></label>
                  <label className={`${ETQ} md:col-span-2`}>Respuesta<input name="respuesta" required minLength={5} maxLength={500} className={CAMPO} /></label>
                </FormAccion>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}

// ── Equipo (permisos) y soporte ───────────────────────────────────────────────
export interface PermisoFila { id: string; usuario_id: string; sede_id: string | null; ver: boolean; configurar: boolean; liquidar: boolean; pagar: boolean; exportar: boolean; novedades: boolean }
export interface AccesoSoporteFila { id: string; estado: string; motivo: string; duracion_min: number | null; expira_at: string | null; agente_id: string | null; created_at: string }

export function PestanaEquipo({ permisos, equipo, sedes, accesos }: { permisos: PermisoFila[]; equipo: Opcion[]; sedes: Opcion[]; accesos: AccesoSoporteFila[] }) {
  return (
    <>
      <Seccion titulo="Quién ve y gestiona las ganancias">
        <p className="mb-3 text-[12.5px] text-text-muted">Ser administrador no da acceso a las ganancias: se concede aquí, por persona y, si quieres, limitado a una sede. Un permiso de sede no permite operar sobre todo el negocio.</p>
        <FormAccion accion={definirPermiso} etiqueta="Guardar permisos" confirmacion="¿Guardar estos permisos?" exito="Permisos guardados." className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <label className={ETQ}>Persona<select name="usuario" required className={CAMPO}>{equipo.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>
          <label className={ETQ}>Sede<select name="sede" className={CAMPO}><option value="">Todo el negocio</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
          <fieldset className="col-span-2 flex flex-wrap items-end gap-3 text-[12.5px]">
            {[["ver", "Ver"], ["configurar", "Configurar reglas"], ["liquidar", "Liquidar"], ["pagar", "Registrar pagos"], ["exportar", "Exportar"], ["novedades", "Novedades"]].map(([k, t]) => (
              <label key={k} className="flex items-center gap-1"><input type="checkbox" name={k} />{t}</label>
            ))}
          </fieldset>
        </FormAccion>
        {permisos.length > 0 ? (
          <ul className="mt-4 grid gap-2 text-[12.5px]">
            {permisos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-border bg-bg p-2">
                <span><b>{equipo.find((e) => e.id === p.usuario_id)?.nombre ?? "Persona"}</b> · {p.sede_id ? sedes.find((s) => s.id === p.sede_id)?.nombre ?? "Sede" : "Todo el negocio"} · {[p.ver && "ver", p.configurar && "configurar", p.liquidar && "liquidar", p.pagar && "pagos", p.exportar && "exportar", p.novedades && "novedades"].filter(Boolean).join(", ") || "sin permisos"}</span>
                <FormAccion accion={quitarPermiso} etiqueta="Quitar" variante="ghost" confirmacion="¿Quitar todos los permisos de ganancias de esta persona?">
                  <input type="hidden" name="usuario" value={p.usuario_id} />
                </FormAccion>
              </li>
            ))}
          </ul>
        ) : null}
      </Seccion>
      <Seccion titulo="Acceso de soporte de StylerNow (solo lectura, temporal)">
        <p className="mb-3 text-[12.5px] text-text-muted">El soporte no entra a tus ganancias por su cuenta. Solo si lo pides y lo autorizas, un agente puede ver (no modificar) este módulo durante el tiempo que definas. Todo queda auditado y el acceso se cierra solo.</p>
        <FormAccion accion={solicitarSoporte} etiqueta="Solicitar ayuda de soporte" exito="Solicitud creada." className="mb-4 grid gap-2 md:grid-cols-3">
          <label className={`${ETQ} md:col-span-3`}>¿Qué necesitas revisar? (mín. 10 caracteres)<input name="motivo" required minLength={10} maxLength={500} className={CAMPO} /></label>
        </FormAccion>
        <ul className="grid gap-2 text-[12.5px]">
          {accesos.map((a) => (
            <li key={a.id} className="border-2 border-border bg-bg p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><b>{a.estado.toLowerCase()}</b> · {a.motivo}{a.expira_at ? ` · vence ${new Date(a.expira_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })}` : ""}</span>
                {a.estado === "AUTORIZADO" || a.estado === "SOLICITADO" ? (
                  <FormAccion accion={revocarSoporte} etiqueta={a.estado === "SOLICITADO" ? "Cancelar" : "Revocar ahora"} variante="ghost" confirmacion="¿Cerrar este acceso?">
                    <input type="hidden" name="acceso" value={a.id} />
                  </FormAccion>
                ) : null}
              </div>
              {a.estado === "SOLICITADO" ? (
                <FormAccion accion={autorizarSoporte} etiqueta="Autorizar acceso de lectura" confirmacion="¿Autorizar que soporte VEA (sin modificar) las ganancias de tu negocio durante este tiempo?" exito="Acceso autorizado." className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="acceso" value={a.id} />
                  <label className={ETQ}>Duración<select name="minutos" className={CAMPO} defaultValue="30"><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 hora</option><option value="120">2 horas</option><option value="240">4 horas</option></select></label>
                </FormAccion>
              ) : null}
            </li>
          ))}
          {accesos.length === 0 ? <li className="text-text-muted">Sin solicitudes de soporte.</li> : null}
        </ul>
      </Seccion>
    </>
  );
}
