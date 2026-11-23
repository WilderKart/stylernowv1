"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import {
  alternarCampanaSellosAction,
  asignarVipAction,
  evaluarAscensoVipAction,
  alternarPlanMembresia,
  alternarReglaCashbackAction,
  bloquearGiftCardAdmin,
  confirmarSugerenciaAction,
  configurarReferidosAction,
  crearCampanaSellosAction,
  crearCuentaCorporativaAction,
  crearPlanMembresia,
  crearReglaCashbackAction,
  crearReglaRecompensaAction,
  descartarSugerenciaAction,
  generarSugerenciasAction,
  sembrarNivelesVipAction,
  listarNivelesVip,
  type CampanaSellos,
  type CuentaCorporativa,
  type FamiliaAdmin,
  type GiftCardAdmin,
  type MiembroVip,
  type NivelVip,
  type PlanMembresia,
  type ReferidoConfig,
  type ReglaCashback,
  type ReglaRecompensa,
  type SugerenciaRecompensa,
  type EventoFraudeNegocio,
} from "./actions";

const TABS = ["Membresías", "Gift Cards", "Referidos", "Sellos", "Cashback", "Club VIP", "Familias", "Empresas", "Recompensas IA", "Antifraude"] as const;
type Tab = (typeof TABS)[number];

// Calculado una sola vez al cargar el módulo (no en cada render) para no
// llamar una función impura (Date.now) durante el render de un componente.
const VIGENCIA_CORPORATIVO_DEFAULT = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

/** Qué función del plan exige cada pestaña (las demás están incluidas en todos los planes). */
const REQUIERE: Partial<Record<Tab, "membresias" | "fidelizacion">> = {
  Membresías: "membresias",
  Sellos: "fidelizacion",
  Cashback: "fidelizacion",
  "Club VIP": "fidelizacion",
  Familias: "fidelizacion",
  Empresas: "fidelizacion",
  "Recompensas IA": "fidelizacion",
};

export function VistaLealtadPanel(props: {
  negocioId: string;
  funciones: { membresias: boolean; fidelizacion: boolean };
  planNombre: string;
  planesIniciales: PlanMembresia[];
  giftCardsIniciales: GiftCardAdmin[];
  referidoConfigInicial: ReferidoConfig | null;
  campanasSellosIniciales: CampanaSellos[];
  reglasCashbackIniciales: ReglaCashback[];
  nivelesVipIniciales: NivelVip[];
  miembrosVipIniciales: MiembroVip[];
  familiasIniciales: FamiliaAdmin[];
  cuentasCorpIniciales: CuentaCorporativa[];
  reglasRecompensaIniciales: ReglaRecompensa[];
  sugerenciasIniciales: SugerenciaRecompensa[];
  alertasFraudeIniciales: EventoFraudeNegocio[];
}) {
  const bloqueada = (t: Tab) => {
    const f = REQUIERE[t];
    return f ? !props.funciones[f] : false;
  };
  // Abre en la primera pestaña incluida en el plan.
  const [tab, setTab] = useState<Tab>(() => TABS.find((t) => !(REQUIERE[t] && !props.funciones[REQUIERE[t]!])) ?? "Gift Cards");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Lealtad</h1>
      <p className="mb-6 text-[12px] text-text-faint">Membresías, Gift Cards, Referidos, Sellos, Cashback, Club VIP, Familias, Empresas y el motor de recompensas — ADR-011.</p>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-none border px-3 py-1.5 text-[11.5px] font-bold ${tab === t ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
          >
            {bloqueada(t) ? `🔒 ${t}` : t}
          </button>
        ))}
      </div>

      {bloqueada(tab) ? (
        <div className="border-2 border-border bg-surface p-5" role="status">
          <p className="text-[13px] font-bold text-text">{tab} no está incluido en tu plan {props.planNombre}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
            Mejora tu plan para activar {tab.toLowerCase()} y todo el programa de lealtad. Tus clientes no ven esta función hasta que la actives.
          </p>
          <a href="/panel/suscripcion" className="mt-3 inline-flex h-11 items-center border-2 border-border bg-accent px-4 text-[12.5px] font-bold uppercase text-ink no-underline">
            Ver planes y mejorar
          </a>
        </div>
      ) : null}

      {tab === "Membresías" && !bloqueada("Membresías") ? <TabMembresias negocioId={props.negocioId} planesIniciales={props.planesIniciales} /> : null}
      {tab === "Gift Cards" && !bloqueada("Gift Cards") ? <TabGiftCards giftCardsIniciales={props.giftCardsIniciales} /> : null}
      {tab === "Referidos" && !bloqueada("Referidos") ? <TabReferidos negocioId={props.negocioId} configInicial={props.referidoConfigInicial} /> : null}
      {tab === "Sellos" && !bloqueada("Sellos") ? <TabSellos negocioId={props.negocioId} campanasIniciales={props.campanasSellosIniciales} /> : null}
      {tab === "Cashback" && !bloqueada("Cashback") ? <TabCashback negocioId={props.negocioId} reglasIniciales={props.reglasCashbackIniciales} /> : null}
      {tab === "Club VIP" && !bloqueada("Club VIP") ? <TabVip negocioId={props.negocioId} nivelesIniciales={props.nivelesVipIniciales} miembrosIniciales={props.miembrosVipIniciales} /> : null}
      {tab === "Familias" && !bloqueada("Familias") ? <TabFamilias familiasIniciales={props.familiasIniciales} /> : null}
      {tab === "Empresas" && !bloqueada("Empresas") ? <TabCorporativo negocioId={props.negocioId} cuentasIniciales={props.cuentasCorpIniciales} /> : null}
      {tab === "Recompensas IA" && !bloqueada("Recompensas IA") ? <TabRecompensas negocioId={props.negocioId} reglasIniciales={props.reglasRecompensaIniciales} sugerenciasIniciales={props.sugerenciasIniciales} /> : null}
        {tab === "Antifraude" && !bloqueada("Antifraude") ? <TabAntifraude alertas={props.alertasFraudeIniciales} /> : null}
    </main>
  );
}

function ErrorTexto({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mb-3 text-[12px] font-semibold text-danger">{error}</p>;
}

// ── Membresías ────────────────────────────────────────────────────────────

function TabMembresias({ negocioId, planesIniciales }: { negocioId: string; planesIniciales: PlanMembresia[] }) {
  const [planes, setPlanes] = useState(planesIniciales);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("80000");
  const [duracion, setDuracion] = useState<1 | 3 | 6 | 12>(1);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function onCrear() {
    setGuardando(true);
    setError(null);
    const res = await crearPlanMembresia({ negocioId, nombre, precio: Number(precio), duracionMeses: duracion, congelacionMaxDias: 0 });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setPlanes((prev) => [{ id: crypto.randomUUID(), nombre, precio: Number(precio), duracionMeses: duracion, activo: true, limiteUsosMes: null, descuentoPct: 0, congelacionMaxDias: 0 }, ...prev]);
    setCreando(false);
    setNombre("");
  }

  async function onAlternar(id: string, activo: boolean) {
    const res = await alternarPlanMembresia(id, activo);
    if (res.ok) setPlanes((prev) => prev.map((p) => (p.id === id ? { ...p, activo } : p)));
  }

  return (
    <div>
      <Button size="sm" variant="secondary" className="mb-3" onClick={() => setCreando((v) => !v)}>
        {creando ? "Cancelar" : "Nuevo plan"}
      </Button>
      {creando ? (
        <Card className="mb-4 flex flex-col gap-2.5">
          <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <div className="flex gap-2">
            <Input label="Precio mensual (COP)" type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} />
            <div className="flex flex-col gap-2">
              <label className="text-[11.5px] font-bold uppercase text-text-muted">Duración</label>
              <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value) as 1 | 3 | 6 | 12)} className="h-[52px] rounded-[13px] border border-border bg-surface px-3 text-[13px] text-text">
                <option value={1}>Mensual</option>
                <option value={3}>Trimestral</option>
                <option value={6}>Semestral</option>
                <option value={12}>Anual</option>
              </select>
            </div>
          </div>
          <ErrorTexto error={error} />
          <Button size="sm" loading={guardando} disabled={!nombre.trim()} onClick={onCrear} className="self-start">
            Crear plan
          </Button>
        </Card>
      ) : null}

      {planes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Sin planes de Membresía todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {planes.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-3.5">
              <div>
                <p className="text-[13px] font-semibold text-text">{p.nombre}</p>
                <p className="text-[11px] text-text-faint">{formatCOP(p.precio)} · cada {p.duracionMeses} mes(es)</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={p.activo ? "success" : "neutral"}>{p.activo ? "Activo" : "Pausado"}</Badge>
                <Button size="sm" variant="ghost" onClick={() => onAlternar(p.id, !p.activo)}>
                  {p.activo ? "Pausar" : "Activar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Gift Cards ──────────────────────────────────────────────────────────

function TabGiftCards({ giftCardsIniciales }: { giftCardsIniciales: GiftCardAdmin[] }) {
  const [giftCards, setGiftCards] = useState(giftCardsIniciales);
  const [error, setError] = useState<string | null>(null);
  const [bloqueandoId, setBloqueandoId] = useState<string | null>(null);
  const [motivoBloqueo, setMotivoBloqueo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function onBloquear() {
    if (!bloqueandoId) return;
    if (motivoBloqueo.trim().length < 3) return setError("Indica el motivo del bloqueo (m?nimo 3 caracteres).");
    setGuardando(true);
    setError(null);
    const res = await bloquearGiftCardAdmin(bloqueandoId, motivoBloqueo.trim());
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setGiftCards((prev) => prev.map((g) => (g.id === bloqueandoId ? { ...g, estado: "BLOQUEADA" } : g)));
    setBloqueandoId(null);
    setMotivoBloqueo("");
  }

  return (
    <div>
      <p className="mb-3 text-[12px] text-text-faint">Las Gift Cards las compra el Cliente desde su propio StylerWallet. Aqu? solo administras las emitidas por tu negocio.</p>
      <ErrorTexto error={error} />
      {bloqueandoId ? (
        <Card className="mb-4 flex flex-col gap-2.5">
          <Input label="Motivo del bloqueo" value={motivoBloqueo} onChange={(e) => setMotivoBloqueo(e.target.value)} maxLength={300} />
          <div className="flex gap-2">
            <Button size="sm" loading={guardando} onClick={onBloquear}>Confirmar bloqueo</Button>
            <Button size="sm" variant="ghost" onClick={() => { setBloqueandoId(null); setMotivoBloqueo(""); }}>Cancelar</Button>
          </div>
        </Card>
      ) : null}
      {giftCards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Todav?a no se compr? ninguna Gift Card de tu negocio.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {giftCards.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-3.5">
              <div>
                <p className="text-[13px] font-semibold text-text">{g.codigo}</p>
                <p className="text-[11px] text-text-faint">{formatCOP(g.saldoActual)} de {formatCOP(g.montoOriginal)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={g.estado === "ACTIVA" ? "success" : g.estado === "CANJEADA" ? "neutral" : "danger"}>{g.estado}</Badge>
                {g.estado === "ACTIVA" ? (
                  <Button size="sm" variant="ghost" onClick={() => { setBloqueandoId(g.id); setMotivoBloqueo(""); setError(null); }}>
                    Bloquear
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Referidos ───────────────────────────────────────────────────────────

function TabReferidos({ negocioId, configInicial }: { negocioId: string; configInicial: ReferidoConfig | null }) {
  const [monto, setMonto] = useState(String(configInicial?.monto ?? 10000));
  const [activo, setActivo] = useState(configInicial?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function onGuardar() {
    setGuardando(true);
    setError(null);
    setGuardado(false);
    const res = await configurarReferidosAction({ negocioId, monto: Number(monto), porcentaje: null, limiteMensual: null, vigenciaDias: 90, activo });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setGuardado(true);
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-[12px] text-text-faint">Cuando un Cliente referido completa su primera Reserva pagada, quien lo refirió recibe esta recompensa en su StylerWallet.</p>
      <Input label="Monto de recompensa (COP)" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
      <label className="flex items-center gap-2 text-[12.5px] text-text-muted">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Programa de referidos activo
      </label>
      <ErrorTexto error={error} />
      {guardado ? <p className="text-[12px] font-semibold text-success">Guardado.</p> : null}
      <Button size="sm" loading={guardando} onClick={onGuardar} className="self-start">
        Guardar
      </Button>
    </Card>
  );
}

// ── Sellos ──────────────────────────────────────────────────────────────

function TabSellos({ negocioId, campanasIniciales }: { negocioId: string; campanasIniciales: CampanaSellos[] }) {
  const [campanas, setCampanas] = useState(campanasIniciales);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [sellosRequeridos, setSellosRequeridos] = useState("10");
  const [recompensa, setRecompensa] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrear() {
    setGuardando(true);
    setError(null);
    const res = await crearCampanaSellosAction({ negocioId, nombre, sellosRequeridos: Number(sellosRequeridos), recompensaDescripcion: recompensa });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setCampanas((prev) => [{ id: crypto.randomUUID(), nombre, sellosRequeridos: Number(sellosRequeridos), recompensaDescripcion: recompensa, estado: "ACTIVA" }, ...prev]);
    setCreando(false);
    setNombre("");
    setRecompensa("");
  }

  async function onAlternar(id: string, estado: "ACTIVA" | "PAUSADA") {
    const res = await alternarCampanaSellosAction(id, estado);
    if (res.ok) setCampanas((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)));
  }

  return (
    <div>
      <Button size="sm" variant="secondary" className="mb-3" onClick={() => setCreando((v) => !v)}>
        {creando ? "Cancelar" : "Nueva campaña"}
      </Button>
      {creando ? (
        <Card className="mb-4 flex flex-col gap-2.5">
          <Input label="Nombre (ej. '10 cortes')" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input label="Sellos requeridos" type="number" value={sellosRequeridos} onChange={(e) => setSellosRequeridos(e.target.value)} />
          <Input label="Recompensa (ej. 'Corte gratis')" value={recompensa} onChange={(e) => setRecompensa(e.target.value)} />
          <ErrorTexto error={error} />
          <Button size="sm" loading={guardando} disabled={!nombre.trim() || !recompensa.trim()} onClick={onCrear} className="self-start">
            Crear campaña
          </Button>
        </Card>
      ) : null}

      {campanas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Sin campañas de Sellos todavía. Aplica a cualquier Servicio por defecto.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campanas.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-3.5">
              <div>
                <p className="text-[13px] font-semibold text-text">{c.nombre}</p>
                <p className="text-[11px] text-text-faint">{c.sellosRequeridos} sellos → {c.recompensaDescripcion}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={c.estado === "ACTIVA" ? "success" : "neutral"}>{c.estado}</Badge>
                {c.estado !== "FINALIZADA" ? (
                  <Button size="sm" variant="ghost" onClick={() => onAlternar(c.id, c.estado === "ACTIVA" ? "PAUSADA" : "ACTIVA")}>
                    {c.estado === "ACTIVA" ? "Pausar" : "Reanudar"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Cashback ────────────────────────────────────────────────────────────

function TabCashback({ negocioId, reglasIniciales }: { negocioId: string; reglasIniciales: ReglaCashback[] }) {
  const [reglas, setReglas] = useState(reglasIniciales);
  const [creando, setCreando] = useState(false);
  const [porcentaje, setPorcentaje] = useState("5");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrear() {
    setGuardando(true);
    setError(null);
    const res = await crearReglaCashbackAction({ negocioId, porcentaje: Number(porcentaje), limiteMensual: null });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setReglas((prev) => [{ id: crypto.randomUUID(), porcentaje: Number(porcentaje), activo: true, limiteMensual: null }, ...prev]);
    setCreando(false);
  }

  async function onAlternar(id: string, activo: boolean) {
    const res = await alternarReglaCashbackAction(id, activo);
    if (res.ok) setReglas((prev) => prev.map((r) => (r.id === id ? { ...r, activo } : r)));
  }

  return (
    <div>
      <Button size="sm" variant="secondary" className="mb-3" onClick={() => setCreando((v) => !v)}>
        {creando ? "Cancelar" : "Nueva regla"}
      </Button>
      {creando ? (
        <Card className="mb-4 flex flex-col gap-2.5">
          <Input label="Porcentaje de cashback" type="number" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} />
          <p className="text-[11px] text-text-faint">Aplica sobre Servicios y Productos por defecto. El cashback nunca es efectivo: entra al StylerWallet del Cliente.</p>
          <ErrorTexto error={error} />
          <Button size="sm" loading={guardando} onClick={onCrear} className="self-start">
            Crear regla
          </Button>
        </Card>
      ) : null}

      {reglas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Sin reglas de Cashback todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reglas.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-3.5">
              <p className="text-[13px] font-semibold text-text">{r.porcentaje}% de cashback</p>
              <div className="flex items-center gap-2">
                <Badge tone={r.activo ? "success" : "neutral"}>{r.activo ? "Activa" : "Pausada"}</Badge>
                <Button size="sm" variant="ghost" onClick={() => onAlternar(r.id, !r.activo)}>
                  {r.activo ? "Pausar" : "Activar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Club VIP ────────────────────────────────────────────────────────────

function TabVip({ negocioId, nivelesIniciales, miembrosIniciales }: { negocioId: string; nivelesIniciales: NivelVip[]; miembrosIniciales: MiembroVip[] }) {
  const [niveles, setNiveles] = useState(nivelesIniciales);
  const [miembros] = useState(miembrosIniciales);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asignar, setAsignar] = useState({ clienteId: "", nivelId: "" });
  const [evaluarClienteId, setEvaluarClienteId] = useState("");

  async function onSembrar() { setMsg(null); setError(null); const res = await sembrarNivelesVipAction(negocioId); if (!res.ok) return setError(res.error); const r = await listarNivelesVip(negocioId); if (r.ok) setNiveles(r.data); setMsg("Niveles Bronce, Plata y Oro creados."); }
  async function onAsignar() { setMsg(null); setError(null); if (!asignar.clienteId || !asignar.nivelId) return setError("Selecciona cliente y nivel."); const res = await asignarVipAction({ negocioId, clienteId: asignar.clienteId, nivelId: asignar.nivelId }); if (!res.ok) return setError(res.error); setMsg("Miembro VIP asignado."); setAsignar({ clienteId: "", nivelId: "" }); }
  async function onEvaluar() { setMsg(null); setError(null); if (!evaluarClienteId) return setError("Selecciona un cliente para evaluar ascenso."); const res = await evaluarAscensoVipAction({ negocioId, clienteId: evaluarClienteId }); if (!res.ok) return setError(res.error); setMsg("Ascenso evaluado."); }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-display text-[14px] font-bold text-text">Club VIP</h2><p className="text-[11.5px] text-text-faint">Asigna miembros y eval?a ascensos autom?ticos.</p></div>{niveles.length === 0 ? <Button size="sm" onClick={onSembrar}>Crear Bronce/Plata/Oro</Button> : null}</div>
      {msg ? <p className="mb-2 text-[12px] font-semibold text-success">{msg}</p> : null}{error ? <p className="mb-2 text-[12px] font-semibold text-danger">{error}</p> : null}
      {niveles.length > 0 ? <div className="mb-4 grid gap-2 rounded-2xl border border-border-subtle bg-surface p-3 sm:grid-cols-3">
        <label className="text-[11px] font-semibold text-text-faint">Cliente<select value={asignar.clienteId} onChange={(e)=>setAsignar(p=>({...p,clienteId:e.target.value}))} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-2 text-[12px] text-text"><option value="">Selecciona</option>{miembros.map(m=><option key={m.clienteId} value={m.clienteId}>{m.clienteNombre}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-text-faint">Nivel<select value={asignar.nivelId} onChange={(e)=>setAsignar(p=>({...p,nivelId:e.target.value}))} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-2 text-[12px] text-text"><option value="">Selecciona</option>{niveles.map(n=><option key={n.id} value={n.id}>{n.nombre}</option>)}</select></label>
        <div className="flex items-end"><Button size="sm" onClick={onAsignar}>Asignar</Button></div>
        <label className="text-[11px] font-semibold text-text-faint sm:col-span-2">Evaluar ascenso<select value={evaluarClienteId} onChange={(e)=>setEvaluarClienteId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-2 text-[12px] text-text"><option value="">Selecciona cliente</option>{miembros.map(m=><option key={m.clienteId} value={m.clienteId}>{m.clienteNombre}</option>)}</select></label>
        <div className="flex items-end"><Button size="sm" variant="secondary" onClick={onEvaluar}>Evaluar ascenso</Button></div>
      </div> : null}
      <div className="mb-4 flex gap-2">{niveles.map(n=><Card key={n.id} className="flex-1 text-center"><p className="text-[13px] font-bold text-text">{n.nombre}</p>{n.beneficios ? <p className="mt-0.5 text-[10.5px] text-text-faint">{n.beneficios}</p> : null}</Card>)}</div>
      {miembros.length === 0 ? <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Sin miembros VIP todav?a.</p> : <ul className="flex flex-col gap-2">{miembros.map(m=><li key={m.clienteId} className="rounded-2xl border border-border-subtle bg-surface px-4 py-3"><p className="text-[13px] font-semibold text-text">{m.clienteNombre}</p><p className="text-[11px] text-text-faint">{m.nivelNombre} ? {m.origen}</p></li>)}</ul>}
    </div>
  );
}


function TabFamilias({ familiasIniciales }: { familiasIniciales: FamiliaAdmin[] }) {
  if (familiasIniciales.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Sin grupos familiares registrados.</p>;
  }
  return (
    <div>
      <h2 className="font-display mb-2 text-[14px] font-bold text-text">Familias</h2>
      <p className="mb-3 text-[11.5px] text-text-faint">Grupos familiares asociados a tu negocio (solo lectura).</p>
      <ul className="flex flex-col gap-2">
        {familiasIniciales.map((f) => (
          <li key={f.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface px-4 py-3">
            <div><p className="text-[13px] font-semibold text-text">{f.nombre}</p><p className="text-[11px] text-text-faint">Titular: {f.titularNombre}</p></div>
            <Badge tone="neutral">{f.miembros} miembros</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
function TabCorporativo({ negocioId, cuentasIniciales }: { negocioId: string; cuentasIniciales: CuentaCorporativa[] }) {
  const [cuentas, setCuentas] = useState(cuentasIniciales);
  const [creando, setCreando] = useState(false);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [cupos, setCupos] = useState("10");
  const [vigencia, setVigencia] = useState(VIGENCIA_CORPORATIVO_DEFAULT);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrear() {
    setGuardando(true);
    setError(null);
    const res = await crearCuentaCorporativaAction({ negocioId, nombreEmpresa, contactoEmail: email, cuposTotales: Number(cupos), vigenciaFin: vigencia });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setCuentas((prev) => [{ id: crypto.randomUUID(), nombreEmpresa, cuposTotales: Number(cupos), vigenciaFin: vigencia, activo: true }, ...prev]);
    setCreando(false);
    setNombreEmpresa("");
    setEmail("");
  }

  return (
    <div>
      <Button size="sm" variant="secondary" className="mb-3" onClick={() => setCreando((v) => !v)}>
        {creando ? "Cancelar" : "Nueva cuenta corporativa"}
      </Button>
      {creando ? (
        <Card className="mb-4 flex flex-col gap-2.5">
          <Input label="Nombre de la empresa" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} />
          <Input label="Email de contacto" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <Input label="Cupos" type="number" value={cupos} onChange={(e) => setCupos(e.target.value)} />
            <Input label="Vigente hasta" type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
          </div>
          <ErrorTexto error={error} />
          <Button size="sm" loading={guardando} disabled={!nombreEmpresa.trim() || !email.trim()} onClick={onCrear} className="self-start">
            Crear cuenta
          </Button>
        </Card>
      ) : null}

      {cuentas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Sin cuentas corporativas todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cuentas.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-3.5">
              <div>
                <p className="text-[13px] font-semibold text-text">{c.nombreEmpresa}</p>
                <p className="text-[11px] text-text-faint">{c.cuposTotales} cupos · vigente hasta {new Date(c.vigenciaFin).toLocaleDateString("es-CO")}</p>
              </div>
              <Badge tone={c.activo ? "success" : "neutral"}>{c.activo ? "Activa" : "Inactiva"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Motor de recompensas automáticas ────────────────────────────────────

const DISPARADOR_ETIQUETA: Record<string, string> = {
  CLIENTE_INACTIVO: "Cliente inactivo",
  CUMPLEANOS: "Cumpleaños",
  OBJETIVO_LOGRADO: "Objetivo logrado",
  RIESGO_ABANDONO: "Riesgo de abandono",
  MEJOR_HORARIO: "Mejor horario",
};

function TabRecompensas({ negocioId, reglasIniciales, sugerenciasIniciales }: { negocioId: string; reglasIniciales: ReglaRecompensa[]; sugerenciasIniciales: SugerenciaRecompensa[] }) {
  const [reglas, setReglas] = useState(reglasIniciales);
  const [sugerencias, setSugerencias] = useState(sugerenciasIniciales);
  const [creando, setCreando] = useState(false);
  const [disparador, setDisparador] = useState<"CLIENTE_INACTIVO"|"CUMPLEANOS"|"OBJETIVO_LOGRADO"|"RIESGO_ABANDONO"|"MEJOR_HORARIO">("CLIENTE_INACTIVO");
  const [montoCredito, setMontoCredito] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrearRegla() {
    setGuardando(true);
    setError(null);
    const res = await crearReglaRecompensaAction({ negocioId, disparador, nivelIa: 0, montoCredito: montoCredito ? Number(montoCredito) : null });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setReglas((prev) => [{ id: crypto.randomUUID(), disparador, nivelIa: 0, activo: true }, ...prev]);
    setCreando(false);
    setMontoCredito("");
  }

  async function onGenerar() {
    setGenerando(true);
    setError(null);
    const res = await generarSugerenciasAction(negocioId);
    setGenerando(false);
    if (!res.ok) return setError(res.error);
    window.location.reload();
  }

  async function onConfirmar(id: string) {
    const res = await confirmarSugerenciaAction(id);
    if (res.ok) setSugerencias((prev) => prev.map((s) => (s.id === id ? { ...s, estado: "CONFIRMADA" } : s)));
  }

  async function onDescartar(id: string) {
    const res = await descartarSugerenciaAction(id);
    if (res.ok) setSugerencias((prev) => prev.map((s) => (s.id === id ? { ...s, estado: "DESCARTADA" } : s)));
  }

  const pendientes = sugerencias.filter((s) => s.estado === "PENDIENTE");

  return (
    <div>
      <p className="mb-3 text-[12px] text-text-faint">
        Reglas Nivel 0 (sin IA): detección automática por datos. La IA (OpenRouter/Nemotron) se usa para redactar sugerencias más elaboradas en próximas versiones — hoy toda sugerencia requiere tu confirmación antes de cualquier efecto de dinero.
      </p>
      <ErrorTexto error={error} />

      <div className="mb-4 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setCreando((v) => !v)}>
          {creando ? "Cancelar" : "Nueva regla"}
        </Button>
        <Button size="sm" loading={generando} onClick={onGenerar} disabled={reglas.filter((r) => r.activo).length === 0}>
          Buscar oportunidades ahora
        </Button>
      </div>

      {creando ? (
        <Card className="mb-4 flex flex-col gap-2.5">
          <div className="flex flex-col gap-2">
            <label className="text-[11.5px] font-bold uppercase text-text-muted">Disparador</label>
            <select value={disparador} onChange={(e) => setDisparador(e.target.value as typeof disparador)} className="h-[52px] rounded-[13px] border border-border bg-surface px-3 text-[13px] text-text">
              {Object.entries(DISPARADOR_ETIQUETA).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <Input label="Crédito automático a StylerWallet al confirmar (opcional, COP)" type="number" value={montoCredito} onChange={(e) => setMontoCredito(e.target.value)} />
          <Button size="sm" loading={guardando} onClick={onCrearRegla} className="self-start">
            Crear regla
          </Button>
        </Card>
      ) : null}

      {reglas.length > 0 ? (
        <ul className="mb-5 flex flex-col gap-2">
          {reglas.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-3.5">
              <p className="text-[13px] font-semibold text-text">{DISPARADOR_ETIQUETA[r.disparador] ?? r.disparador}</p>
              <Badge tone={r.activo ? "success" : "neutral"}>{r.activo ? "Activa" : "Pausada"}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="font-display mb-2 text-[12px] font-bold uppercase text-text">Sugerencias pendientes</h2>
      {pendientes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Sin sugerencias pendientes. Toca &quot;Buscar oportunidades ahora&quot;.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pendientes.map((s) => (
            <li key={s.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
              <p className="text-[12.5px] text-text">{s.descripcion}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => onConfirmar(s.id)}>Confirmar</Button>
                <Button size="sm" variant="ghost" onClick={() => onDescartar(s.id)}>Descartar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function TabAntifraude({ alertas }: { alertas: EventoFraudeNegocio[] }) {
  if (alertas.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">Sin alertas antifraude pendientes.</p>;
  }
  return (
    <div>
      <h2 className="font-display mb-2 text-[14px] font-bold text-text">Alertas antifraude</h2>
      <p className="mb-3 text-[11.5px] text-text-faint">Alertas de tu negocio. La revisi?n final la realiza SuperSU en /admin/lealtad.</p>
      <ul className="flex flex-col gap-2">
        {alertas.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
            <div className="flex items-center gap-2">
              <p className="text-[12.5px] font-semibold text-text">{a.tipo.replaceAll("_", " ")}</p>
              <Badge tone={a.severidad === "ALTA" ? "danger" : a.severidad === "MEDIA" ? "accent" : "neutral"}>{a.severidad}</Badge>
            </div>
            <p className="mt-1 text-[10.5px] text-text-faint">{new Date(a.createdAt).toLocaleString("es-CO")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
