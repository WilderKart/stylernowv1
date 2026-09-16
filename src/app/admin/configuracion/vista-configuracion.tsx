"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import {
  actualizarBanner,
  actualizarCiudad,
  actualizarComisionGlobal,
  actualizarPlan,
  actualizarTarifasAds,
  crearBanner,
  eliminarBanner,
  publicarTextoLegal,
  type BannerAdmin,
  type CiudadAdmin,
  type MetricasAdsPlataforma,
  type PlanAdmin,
  type TarifasAds,
  type TextoLegalAdmin,
} from "./actions";

export function VistaConfiguracion({
  comisionInicial,
  ciudadesIniciales,
  bannersIniciales,
  planesIniciales,
  textosIniciales,
  tarifasAdsIniciales,
  metricasAdsIniciales,
}: {
  comisionInicial: number;
  ciudadesIniciales: CiudadAdmin[];
  bannersIniciales: BannerAdmin[];
  planesIniciales: PlanAdmin[];
  textosIniciales: TextoLegalAdmin[];
  tarifasAdsIniciales: TarifasAds;
  metricasAdsIniciales: MetricasAdsPlataforma;
}) {
  return (
    <div className="flex flex-col gap-10">
      <SeccionComision comisionInicial={comisionInicial} />
      <SeccionCiudades ciudadesIniciales={ciudadesIniciales} />
      <SeccionBanners bannersIniciales={bannersIniciales} />
      <SeccionPlanes planesIniciales={planesIniciales} />
      <SeccionTextosLegales textosIniciales={textosIniciales} />
      <SeccionAds tarifasIniciales={tarifasAdsIniciales} metricas={metricasAdsIniciales} />
    </div>
  );
}

// ── Marketplace Ads: tarifas de referencia (SuperSU) ────────────────────

function SeccionAds({ tarifasIniciales, metricas }: { tarifasIniciales: TarifasAds; metricas: MetricasAdsPlataforma }) {
  const [tarifas, setTarifas] = useState(tarifasIniciales);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    const res = await actualizarTarifasAds(tarifas);
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setMensaje("Tarifas actualizadas.");
  }

  return (
    <section>
      <h2 className="font-display mb-1 text-[14px] font-bold uppercase text-text">Marketplace Ads — tarifas de referencia</h2>
      <p className="mb-3 text-[12px] text-text-faint">
        Base de cobro para las campañas Destacado y Pin patrocinado de las Barberías.
      </p>
      <div className="mb-4 flex gap-4 text-[12.5px] text-text-muted">
        <span>
          Gasto total de la plataforma: <strong className="text-text">{formatCOP(metricas.gastoTotalPlataforma)}</strong>
        </span>
        <span>
          Campañas activas: <strong className="text-text">{metricas.campanasActivas}</strong>
        </span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Input
          label="CPC Destacado (COP)"
          type="number"
          value={tarifas.cpcDestacado}
          onChange={(e) => setTarifas({ ...tarifas, cpcDestacado: Number(e.target.value) })}
        />
        <Input
          label="CPC Pin (COP)"
          type="number"
          value={tarifas.cpcPin}
          onChange={(e) => setTarifas({ ...tarifas, cpcPin: Number(e.target.value) })}
        />
        <Input
          label="CPM Pin (COP/1000)"
          type="number"
          value={tarifas.cpmPin}
          onChange={(e) => setTarifas({ ...tarifas, cpmPin: Number(e.target.value) })}
        />
      </div>
      {mensaje ? <p className="mb-2 text-[11.5px] font-semibold text-success">{mensaje}</p> : null}
      {error ? <p className="mb-2 text-[11.5px] font-semibold text-danger">{error}</p> : null}
      <Button size="sm" loading={guardando} onClick={guardar}>
        Guardar tarifas
      </Button>
    </section>
  );
}

// ── Comisión de plataforma ─────────────────────────────────────────────────

function SeccionComision({ comisionInicial }: { comisionInicial: number }) {
  const [valor, setValor] = useState(comisionInicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    const res = await actualizarComisionGlobal(valor);
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setMensaje("Comisión actualizada — aplica a la próxima transacción de cada negocio.");
  }

  return (
    <section>
      <h2 className="font-display mb-1 text-[14px] font-bold uppercase text-text">Comisión de plataforma</h2>
      <p className="mb-3 text-[12px] text-text-faint">
        Rango permitido 3%-15%. Afecta de inmediato a todos los negocios; los pagos ya en proceso de aprobación no se recalculan.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="range"
          min={3}
          max={15}
          step={0.5}
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          className="h-2 w-56 accent-accent"
        />
        <span className="w-14 text-[15px] font-bold text-text">{valor.toFixed(1)}%</span>
        <Button size="sm" loading={guardando} onClick={guardar}>
          Guardar
        </Button>
      </div>
      {mensaje ? <p className="mt-2 text-[11.5px] font-semibold text-success">{mensaje}</p> : null}
      {error ? <p className="mt-2 text-[11.5px] font-semibold text-danger">{error}</p> : null}
    </section>
  );
}

// ── Ciudades habilitadas ───────────────────────────────────────────────────

function SeccionCiudades({ ciudadesIniciales }: { ciudadesIniciales: CiudadAdmin[] }) {
  const [ciudades, setCiudades] = useState(ciudadesIniciales);
  const [nueva, setNueva] = useState("");
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(ciudad: string, habilitada: boolean) {
    setActualizando(ciudad);
    setError(null);
    const res = await actualizarCiudad(ciudad, habilitada);
    setActualizando(null);
    if (!res.ok) return setError(res.error);
    setCiudades((prev) => prev.map((c) => (c.ciudad === ciudad ? { ...c, habilitada } : c)));
  }

  async function agregar() {
    const nombre = nueva.trim();
    if (!nombre) return;
    setActualizando(nombre);
    setError(null);
    const res = await actualizarCiudad(nombre, true);
    setActualizando(null);
    if (!res.ok) return setError(res.error);
    setCiudades((prev) => [...prev, { ciudad: nombre, habilitada: true, negociosActivos: 0 }].sort((a, b) => a.ciudad.localeCompare(b.ciudad)));
    setNueva("");
  }

  return (
    <section>
      <h2 className="font-display mb-1 text-[14px] font-bold uppercase text-text">Ciudades habilitadas</h2>
      <p className="mb-3 text-[12px] text-text-faint">
        Deshabilitar una ciudad la oculta del Marketplace de inmediato — no suspende los negocios que operan ahí.
      </p>
      <div className="mb-3 flex gap-2">
        <Input placeholder="Nueva ciudad (ej. Medellín)" value={nueva} onChange={(e) => setNueva(e.target.value)} className="h-10 max-w-xs" />
        <Button size="sm" variant="secondary" loading={actualizando === nueva.trim()} onClick={agregar}>
          Agregar
        </Button>
      </div>
      {error ? <p className="mb-3 text-[11.5px] font-semibold text-danger">{error}</p> : null}
      {ciudades.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
          Todavía no hay ciudades registradas.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ciudades.map((c) => (
            <li key={c.ciudad} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
              <div>
                <p className="text-[13px] font-semibold text-text">{c.ciudad}</p>
                <p className="text-[11px] text-text-faint">{c.negociosActivos} negocios activos</p>
              </div>
              <button
                type="button"
                disabled={actualizando === c.ciudad}
                onClick={() => toggle(c.ciudad, !c.habilitada)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  c.habilitada ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                }`}
              >
                {c.habilitada ? "Habilitada" : "Deshabilitada"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Banners del Home ────────────────────────────────────────────────────────

function SeccionBanners({ bannersIniciales }: { bannersIniciales: BannerAdmin[] }) {
  const [banners, setBanners] = useState(bannersIniciales);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ imagenUrl: "", texto: "", urlDestino: "", vigenciaDesde: "", vigenciaHasta: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!form.imagenUrl.trim()) return setError("La URL de la imagen es obligatoria.");
    setGuardando(true);
    setError(null);
    const res = await crearBanner({ ...form, orden: banners.length });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setBanners((prev) => [
      ...prev,
      { id: crypto.randomUUID(), imagenUrl: form.imagenUrl, texto: form.texto || null, urlDestino: form.urlDestino || null, vigenciaDesde: form.vigenciaDesde || null, vigenciaHasta: form.vigenciaHasta || null, activo: true, orden: prev.length },
    ]);
    setForm({ imagenUrl: "", texto: "", urlDestino: "", vigenciaDesde: "", vigenciaHasta: "" });
    setCreando(false);
  }

  async function toggleActivo(id: string, activo: boolean) {
    setError(null);
    const res = await actualizarBanner(id, { activo });
    if (!res.ok) return setError(res.error);
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, activo } : b)));
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este banner?")) return;
    setError(null);
    const res = await eliminarBanner(id);
    if (!res.ok) return setError(res.error);
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-[14px] font-bold uppercase text-text">Banners del Home</h2>
        <Button size="sm" variant="secondary" onClick={() => setCreando((v) => !v)}>
          {creando ? "Cancelar" : "Nuevo banner"}
        </Button>
      </div>
      <p className="mb-3 text-[12px] text-text-faint">Imagen, texto y vigencia — se muestran en el Home del Marketplace sin desplegar código.</p>

      {creando ? (
        <Card className="mb-3 flex flex-col gap-3">
          <Input label="URL de la imagen" value={form.imagenUrl} onChange={(e) => setForm({ ...form, imagenUrl: e.target.value })} />
          <Input label="Texto (opcional)" value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
          <Input label="Link de destino (opcional)" value={form.urlDestino} onChange={(e) => setForm({ ...form, urlDestino: e.target.value })} />
          <div className="flex gap-3">
            <Input label="Vigente desde" type="datetime-local" value={form.vigenciaDesde} onChange={(e) => setForm({ ...form, vigenciaDesde: e.target.value })} />
            <Input label="Vigente hasta" type="datetime-local" value={form.vigenciaHasta} onChange={(e) => setForm({ ...form, vigenciaHasta: e.target.value })} />
          </div>
          <Button size="sm" loading={guardando} onClick={crear}>
            Publicar banner
          </Button>
        </Card>
      ) : null}

      {error ? <p className="mb-3 text-[11.5px] font-semibold text-danger">{error}</p> : null}

      {banners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
          Todavía no hay banners configurados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {banners.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-text">{b.texto || b.imagenUrl}</p>
                <p className="truncate text-[11px] text-text-faint">{b.imagenUrl}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={b.activo ? "success" : "neutral"}>{b.activo ? "Activo" : "Inactivo"}</Badge>
                <button type="button" onClick={() => toggleActivo(b.id, !b.activo)} className="text-[11px] font-semibold text-accent">
                  {b.activo ? "Desactivar" : "Activar"}
                </button>
                <button type="button" onClick={() => eliminar(b.id)} className="text-[11px] font-semibold text-danger">
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Planes SaaS ──────────────────────────────────────────────────────────

function SeccionPlanes({ planesIniciales }: { planesIniciales: PlanAdmin[] }) {
  const [planes, setPlanes] = useState(planesIniciales);
  const [editando, setEditando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actual = planes.find((p) => p.codigo === editando) ?? null;

  async function guardar() {
    if (!actual) return;
    setGuardando(true);
    setError(null);
    const res = await actualizarPlan(actual);
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setEditando(null);
  }

  return (
    <section>
      <h2 className="font-display mb-1 text-[14px] font-bold uppercase text-text">Planes SaaS</h2>
      <p className="mb-3 text-[12px] text-text-faint">
        Un cambio solo afecta a suscripciones nuevas o a la próxima renovación — nunca retroactivo a mitad de ciclo.
      </p>
      <ul className="flex flex-col gap-2">
        {planes.map((p) => (
          <li key={p.codigo} className="rounded-xl border border-border-subtle bg-surface p-3.5">
            {editando === p.codigo && actual ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Precio mensual (COP)"
                    type="number"
                    value={actual.precioMensual ?? ""}
                    onChange={(e) => setPlanes((prev) => prev.map((x) => (x.codigo === p.codigo ? { ...x, precioMensual: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                  />
                  <Input
                    label="Límite de Sedes"
                    type="number"
                    value={actual.limiteSedes ?? ""}
                    onChange={(e) => setPlanes((prev) => prev.map((x) => (x.codigo === p.codigo ? { ...x, limiteSedes: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                  />
                  <Input
                    label="Staff incluido"
                    type="number"
                    value={actual.staffIncluido ?? ""}
                    onChange={(e) => setPlanes((prev) => prev.map((x) => (x.codigo === p.codigo ? { ...x, staffIncluido: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                  />
                  <Input
                    label="Créditos IA / mes"
                    type="number"
                    value={actual.creditosIaMes ?? ""}
                    onChange={(e) => setPlanes((prev) => prev.map((x) => (x.codigo === p.codigo ? { ...x, creditosIaMes: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                  />
                </div>
                <div className="flex gap-4 text-[12.5px] text-text-muted">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={actual.guardianDisponible}
                      onChange={(e) => setPlanes((prev) => prev.map((x) => (x.codigo === p.codigo ? { ...x, guardianDisponible: e.target.checked } : x)))}
                    />
                    Guardian disponible
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={actual.marketplaceAdsDisponible}
                      onChange={(e) => setPlanes((prev) => prev.map((x) => (x.codigo === p.codigo ? { ...x, marketplaceAdsDisponible: e.target.checked } : x)))}
                    />
                    Marketplace Ads
                  </label>
                </div>
                {error ? <p className="text-[11.5px] font-semibold text-danger">{error}</p> : null}
                <div className="flex gap-2">
                  <Button size="sm" loading={guardando} onClick={guardar}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13.5px] font-bold text-text">{p.nombre}</p>
                  <p className="text-[11.5px] text-text-faint">
                    {p.precioMensual !== null ? formatCOP(p.precioMensual) + "/mes" : "Personalizado"} · {p.limiteSedes ?? "∞"} Sedes · {p.staffIncluido ?? "∞"} Staff
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEditando(p.codigo)}>
                  Editar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Textos legales ─────────────────────────────────────────────────────────

const TIPOS_LEGALES = [
  { valor: "POLITICA_DATOS", etiqueta: "Política de Tratamiento de Datos" },
  { valor: "TERMINOS", etiqueta: "Términos y Condiciones" },
] as const;

function SeccionTextosLegales({ textosIniciales }: { textosIniciales: TextoLegalAdmin[] }) {
  const [textos, setTextos] = useState(textosIniciales);
  const [tipoActivo, setTipoActivo] = useState<string>("POLITICA_DATOS");
  const [editando, setEditando] = useState(false);
  const [contenido, setContenido] = useState("");
  const [cambioMaterial, setCambioMaterial] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vigente = textos.filter((t) => t.tipo === tipoActivo).sort((a, b) => b.version - a.version)[0] ?? null;

  function iniciarEdicion() {
    setContenido(vigente?.contenido ?? "");
    setCambioMaterial(false);
    setEditando(true);
  }

  async function publicar() {
    if (!contenido.trim()) return setError("El texto no puede estar vacío.");
    setGuardando(true);
    setError(null);
    const res = await publicarTextoLegal(tipoActivo, contenido, cambioMaterial);
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setTextos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), tipo: tipoActivo, version: (vigente?.version ?? 0) + 1, contenido, cambioMaterial, publicadoAt: new Date().toISOString() },
    ]);
    setEditando(false);
  }

  return (
    <section>
      <h2 className="font-display mb-1 text-[14px] font-bold uppercase text-text">Textos legales</h2>
      <p className="mb-3 text-[12px] text-text-faint">
        Cada publicación crea una versión nueva — nunca sobreescribe lo que un usuario ya aceptó. Si marcás &ldquo;cambio material&rdquo;, se le pide re-aceptar en su próximo inicio de sesión.
      </p>
      <div className="mb-3 flex gap-1 rounded-full border border-border p-1" style={{ width: "fit-content" }}>
        {TIPOS_LEGALES.map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => {
              setTipoActivo(t.valor);
              setEditando(false);
            }}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${tipoActivo === t.valor ? "bg-accent text-bg" : "text-text-muted"}`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {vigente ? (
        <p className="mb-3 text-[11.5px] text-text-faint">
          Versión vigente: {vigente.version} · publicada {new Date(vigente.publicadoAt).toLocaleDateString("es-CO")}
        </p>
      ) : (
        <p className="mb-3 text-[11.5px] text-text-faint">Todavía no hay ninguna versión publicada de este texto.</p>
      )}

      {editando ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            className="min-h-[220px] rounded-xl border border-border bg-surface p-3 text-[12.5px] text-text outline-none focus:border-accent/60"
          />
          <label className="flex items-center gap-2 text-[12.5px] text-text-muted">
            <input type="checkbox" checked={cambioMaterial} onChange={(e) => setCambioMaterial(e.target.checked)} />
            Cambio material — exige re-aceptación en el próximo inicio de sesión
          </label>
          {error ? <p className="text-[11.5px] font-semibold text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" loading={guardando} onClick={publicar}>
              Publicar versión {(vigente?.version ?? 0) + 1}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={iniciarEdicion}>
          Publicar nueva versión
        </Button>
      )}
    </section>
  );
}
