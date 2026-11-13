"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { pctConsumido, umbralesAlcanzados, validarPlantilla, variablesUsablesEnCampana } from "@/lib/whatsapp/reglas";
import {
  VARIABLES_PLANTILLA,
  type CampanaWhatsApp,
  type Categoria,
  type PlantillaWhatsApp,
  type ResumenPanelWhatsApp,
  type VariablePlantilla,
} from "@/lib/whatsapp/tipos";
import { traducirErrorWhatsApp } from "@/lib/whatsapp/errores";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelarCampana,
  cancelarRecarga,
  contarSegmento,
  crearCampana,
  eliminarPlantilla,
  guardarPlantilla,
  programarCampana,
  solicitarRecarga,
} from "./actions";

type Tono = "success" | "danger" | "neutral" | "accent";

const ETIQUETA_CATEGORIA: Record<Categoria, string> = { UTILIDAD: "Aviso", MARKETING: "Marketing" };

const ETIQUETA_VARIABLE: Record<VariablePlantilla, string> = {
  nombre_cliente: "Nombre del cliente",
  nombre_negocio: "Nombre del negocio",
  fecha_cita: "Fecha de la cita",
  hora_cita: "Hora de la cita",
  servicio: "Servicio",
  sede: "Sede",
};

const ESTADO_PLANTILLA: Record<string, { texto: string; tono: Tono }> = {
  BORRADOR: { texto: "Borrador", tono: "neutral" },
  PENDIENTE_APROBACION: { texto: "En revisión", tono: "accent" },
  APROBADA: { texto: "Aprobada", tono: "success" },
  RECHAZADA: { texto: "Rechazada", tono: "danger" },
};

const ESTADO_CAMPANA: Record<string, { texto: string; tono: Tono }> = {
  BORRADOR: { texto: "Borrador", tono: "neutral" },
  PROGRAMADA: { texto: "Programada", tono: "accent" },
  BLOQUEADA_SIN_CONEXION: { texto: "Bloqueada", tono: "danger" },
  EN_ENVIO: { texto: "En envío", tono: "accent" },
  COMPLETADA: { texto: "Completada", tono: "success" },
  CANCELADA: { texto: "Cancelada", tono: "neutral" },
};

const ESTADO_COMPRA: Record<string, { texto: string; tono: Tono }> = {
  PENDIENTE_PAGO: { texto: "Pendiente de pago", tono: "accent" },
  ACREDITADA: { texto: "Acreditada", tono: "success" },
  CANCELADA: { texto: "Cancelada", tono: "neutral" },
};

const fmt = (n: number) => new Intl.NumberFormat("es-CO").format(n);
const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

function useAccion() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  function ejecutar<T extends { ok: boolean; error?: string }>(fn: () => Promise<T>, alTerminar?: (r: T) => void) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "No pudimos completar la acción.");
        return;
      }
      alTerminar?.(r);
      router.refresh();
    });
  }
  return { pendiente, error, aviso, setAviso, ejecutar };
}

export function VistaWhatsApp({ resumen, errorInicial }: { resumen: ResumenPanelWhatsApp | null; errorInicial: string | null }) {
  if (!resumen) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
        <h1 className="font-display mb-4 text-[22px] font-bold uppercase text-text">WhatsApp</h1>
        <p className="text-[12.5px] font-semibold text-danger">{errorInicial ?? "No pudimos cargar el módulo de WhatsApp."}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-8 sm:px-10">
      <div>
        <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">WhatsApp</h1>
        <p className="text-[12px] text-text-faint">
          Cuota mensual de tu plan, recargas, plantillas y campañas. Los avisos (recordatorios y confirmaciones) y el marketing se cuentan por separado.
        </p>
      </div>

      {!resumen.conexion.envio_habilitado ? (
        <Card className="border-danger">
          <p className="text-[13px] font-bold text-text">Envío bloqueado: WhatsApp no está conectado.</p>
          <p className="mt-1 text-[12px] text-text-muted">
            Puedes preparar plantillas y campañas, pero ningún mensaje se envía hasta que StylerNow conecte el proveedor oficial de WhatsApp. No
            se descuenta nada de tu cuota mientras tanto.
          </p>
        </Card>
      ) : null}

      <SeccionSaldo resumen={resumen} />
      <SeccionRecargas resumen={resumen} />
      <SeccionPlantillas resumen={resumen} />
      <SeccionCampanas resumen={resumen} />
    </main>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.72px] text-text">{children}</h2>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-[15px] font-bold text-text">{valor}</p>
      <p className="text-[10px] uppercase tracking-wide text-text-faint">{etiqueta}</p>
    </div>
  );
}

function SeccionSaldo({ resumen }: { resumen: ResumenPanelWhatsApp }) {
  const plan = resumen.saldo.plan;
  const cuota = plan?.cuota ?? 0;
  const pct = plan ? pctConsumido(cuota, plan.disponible) : 0;
  const alcanzados = umbralesAlcanzados(pct, resumen.reglas.umbrales_alerta);

  return (
    <section>
      <Titulo>Cuota y consumo del mes</Titulo>
      <Card className="flex flex-col gap-4">
        {plan ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] text-text-muted">
                Plan: <span className="font-bold text-text">{fmt(cuota - plan.disponible)}</span> de {fmt(cuota)} conversaciones usadas
              </p>
              <span className="font-mono text-[12px] font-bold text-text">{pct}%</span>
            </div>
            <Progress value={Math.min(pct, 100)} />
          </>
        ) : (
          <p className="text-[12.5px] text-text-muted">Tu plan no tiene cuota de WhatsApp activa este mes (revisa el estado de tu suscripción).</p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato etiqueta="Disponible total" valor={fmt(Number(resumen.saldo.disponible_total))} />
          <Dato etiqueta="Marketing disponible" valor={fmt(Number(resumen.saldo.marketing_disponible))} />
          <Dato etiqueta="Avisos del mes" valor={fmt(Number(resumen.consumo_mes.utilidad))} />
          <Dato etiqueta="Marketing del mes" valor={fmt(Number(resumen.consumo_mes.marketing))} />
        </div>
        <p className="text-[11.5px] text-text-faint">
          El marketing puede usar hasta el {resumen.reglas.pct_marketing_plan}% de la cuota del plan y el {resumen.reglas.pct_marketing_recarga}% de cada
          recarga. Primero se usa la cuota del plan y después las recargas, empezando por la que vence antes.
        </p>
        {resumen.saldo.recargas.length > 0 ? (
          <ul className="flex flex-col gap-1 border-t border-border-subtle pt-3">
            {resumen.saldo.recargas.map((r) => (
              <li key={r.lote_id} className="flex justify-between text-[12px] text-text-muted">
                <span>
                  Recarga: {fmt(r.disponible)} de {fmt(r.cantidad ?? 0)} disponibles
                </span>
                <span>Vence {fecha(r.vence)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      {alcanzados.length > 0 ? (
        <Card className="mt-3 border-accent">
          {alcanzados.includes(100) || pct >= 100 ? (
            <p className="text-[12.5px] font-bold text-text">Usaste toda la cuota de WhatsApp de tu plan este mes. Los siguientes mensajes salen de tus recargas.</p>
          ) : (
            <p className="text-[12.5px] font-bold text-text">Ya usaste el {alcanzados[alcanzados.length - 1]}% de la cuota de WhatsApp de tu plan este mes.</p>
          )}
        </Card>
      ) : null}
    </section>
  );
}

function SeccionRecargas({ resumen }: { resumen: ResumenPanelWhatsApp }) {
  const { pendiente, error, aviso, setAviso, ejecutar } = useAccion();

  return (
    <section>
      <Titulo>Recargas</Titulo>
      <p className="mb-3 text-[12px] text-text-faint">
        Las recargas son solo para WhatsApp, vencen a los {resumen.reglas.meses_vencimiento_recarga} meses y se usan después de la cuota del plan.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {resumen.paquetes.map((p) => (
          <Card key={p.id} className="flex flex-col gap-2">
            <p className="text-[14px] font-bold text-text">{fmt(p.conversaciones)} conversaciones</p>
            <p className="text-[12.5px] text-text-muted">{p.moneda === "COP" ? formatCOP(Number(p.precio)) : `${fmt(Number(p.precio))} ${p.moneda}`}</p>
            <Button
              size="sm"
              variant="secondary"
              loading={pendiente}
              onClick={() =>
                ejecutar(
                  () => solicitarRecarga(p.id),
                  () => setAviso("Solicitud creada. El pago en línea todavía no está habilitado; podrás completarlo desde aquí cuando lo activemos.")
                )
              }
            >
              Solicitar recarga
            </Button>
          </Card>
        ))}
      </div>
      {aviso ? <p className="mt-3 text-[12px] font-semibold text-text">{aviso}</p> : null}
      {error ? <p className="mt-3 text-[12px] font-semibold text-danger">{error}</p> : null}

      {resumen.compras.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {resumen.compras.map((c) => {
            const e = ESTADO_COMPRA[c.estado] ?? { texto: c.estado, tono: "neutral" as Tono };
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 border border-border-subtle bg-surface p-3">
                <div>
                  <p className="text-[12.5px] font-bold text-text">
                    {fmt(c.conversaciones)} conversaciones · {c.moneda === "COP" ? formatCOP(Number(c.precio)) : `${fmt(Number(c.precio))} ${c.moneda}`}
                  </p>
                  <p className="text-[11px] text-text-faint">{fecha(c.fecha)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={e.tono}>{e.texto}</Badge>
                  {c.estado === "PENDIENTE_PAGO" ? (
                    <Button size="sm" variant="ghost" loading={pendiente} onClick={() => ejecutar(() => cancelarRecarga(c.id))}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

interface BorradorPlantilla {
  plantillaId: string | null;
  nombre: string;
  idioma: "es" | "en";
  categoria: Categoria;
  cuerpo: string;
  variables: VariablePlantilla[];
}

const PLANTILLA_VACIA: BorradorPlantilla = { plantillaId: null, nombre: "", idioma: "es", categoria: "MARKETING", cuerpo: "", variables: [] };

function SeccionPlantillas({ resumen }: { resumen: ResumenPanelWhatsApp }) {
  const { pendiente, error, ejecutar } = useAccion();
  const [borrador, setBorrador] = useState<BorradorPlantilla | null>(null);
  const errorLocal = borrador ? validarPlantilla(borrador.cuerpo, borrador.variables) : null;

  function alternarVariable(v: VariablePlantilla) {
    if (!borrador) return;
    const variables = borrador.variables.includes(v) ? borrador.variables.filter((x) => x !== v) : [...borrador.variables, v];
    setBorrador({ ...borrador, variables });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <Titulo>Plantillas</Titulo>
        <Button size="sm" variant="secondary" onClick={() => setBorrador(borrador ? null : PLANTILLA_VACIA)}>
          {borrador ? "Cerrar" : "Nueva plantilla"}
        </Button>
      </div>
      <p className="mb-3 text-[12px] text-text-faint">
        WhatsApp revisa y aprueba cada plantilla antes de usarla. Esa revisión empieza cuando StylerNow conecte el proveedor; mientras tanto quedan en
        borrador.
      </p>

      {borrador ? (
        <Card className="mb-4 flex flex-col gap-3">
          <Input
            label="Nombre interno"
            placeholder="promo_corte_marzo"
            value={borrador.nombre}
            onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
          />
          <div className="flex flex-wrap gap-2">
            {(["MARKETING", "UTILIDAD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBorrador({ ...borrador, categoria: c })}
                className={`border px-3 py-1.5 text-[12px] font-bold ${borrador.categoria === c ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
              >
                {ETIQUETA_CATEGORIA[c]}
              </button>
            ))}
            {(["es", "en"] as const).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setBorrador({ ...borrador, idioma: i })}
                className={`border px-3 py-1.5 text-[12px] font-bold ${borrador.idioma === i ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
              >
                {i === "es" ? "Español" : "Inglés"}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-1.5 font-mono text-xs font-bold uppercase tracking-[0.72px] text-text">Variables (en orden: {"{{1}}"}, {"{{2}}"}…)</p>
            <div className="flex flex-wrap gap-2">
              {VARIABLES_PLANTILLA.map((v) => {
                const idx = borrador.variables.indexOf(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => alternarVariable(v)}
                    className={`border px-2.5 py-1 text-[11.5px] font-semibold ${idx >= 0 ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
                  >
                    {idx >= 0 ? `{{${idx + 1}}} ` : ""}
                    {ETIQUETA_VARIABLE[v]}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.72px] text-text">Texto</span>
            <textarea
              rows={4}
              maxLength={1024}
              value={borrador.cuerpo}
              onChange={(e) => setBorrador({ ...borrador, cuerpo: e.target.value })}
              placeholder="Hola {{1}}, en {{2}} tenemos 20% en cortes esta semana."
              className="w-full border-2 border-border bg-bg p-3 text-[14px] text-text outline-none focus:shadow-hard"
            />
          </label>
          {borrador.cuerpo && errorLocal ? <p className="text-[12px] text-danger">{traducirErrorWhatsApp(errorLocal)}</p> : null}
          {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
          <Button
            size="sm"
            className="self-start"
            loading={pendiente}
            disabled={!!errorLocal || borrador.nombre.length < 3}
            onClick={() => ejecutar(() => guardarPlantilla(borrador), () => setBorrador(null))}
          >
            Guardar en borrador
          </Button>
        </Card>
      ) : null}

      {resumen.plantillas.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Todavía no tienes plantillas.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {resumen.plantillas.map((t) => (
            <TarjetaPlantilla key={t.id} plantilla={t} onEditar={() => setBorrador({ plantillaId: t.id, nombre: t.nombre, idioma: t.idioma, categoria: t.categoria, cuerpo: t.cuerpo, variables: t.variables })} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TarjetaPlantilla({ plantilla, onEditar }: { plantilla: PlantillaWhatsApp; onEditar: () => void }) {
  const { pendiente, error, ejecutar } = useAccion();
  const e = ESTADO_PLANTILLA[plantilla.estado] ?? { texto: plantilla.estado, tono: "neutral" as Tono };
  const editable = !plantilla.global && (plantilla.estado === "BORRADOR" || plantilla.estado === "RECHAZADA");
  return (
    <li className="border border-border-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-bold text-text">
            {plantilla.nombre} <span className="font-normal text-text-faint">· {ETIQUETA_CATEGORIA[plantilla.categoria]} · {plantilla.idioma.toUpperCase()}</span>
            {plantilla.global ? <span className="font-normal text-text-faint"> · StylerNow</span> : null}
          </p>
          <p className="mt-1 whitespace-pre-line text-[12px] text-text-muted">{plantilla.cuerpo}</p>
          {plantilla.estado === "RECHAZADA" && plantilla.motivo_rechazo ? (
            <p className="mt-1 text-[11.5px] text-danger">Motivo del rechazo: {plantilla.motivo_rechazo}</p>
          ) : null}
        </div>
        <Badge tone={e.tono}>{e.texto}</Badge>
      </div>
      {error ? <p className="mt-2 text-[11.5px] font-semibold text-danger">{error}</p> : null}
      {editable ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={onEditar}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" loading={pendiente} onClick={() => ejecutar(() => eliminarPlantilla(plantilla.id))}>
            Borrar
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function SeccionCampanas({ resumen }: { resumen: ResumenPanelWhatsApp }) {
  const [creando, setCreando] = useState(false);
  const plantillasUsables = resumen.plantillas.filter(
    (t) => t.categoria === "MARKETING" && t.estado !== "RECHAZADA" && variablesUsablesEnCampana(t.variables)
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <Titulo>Campañas</Titulo>
        {resumen.funcion_marketing ? (
          <Button size="sm" variant="secondary" onClick={() => setCreando((v) => !v)}>
            {creando ? "Cerrar" : "Nueva campaña"}
          </Button>
        ) : null}
      </div>
      {!resumen.funcion_marketing ? (
        <Card className="mb-3">
          <p className="text-[12.5px] text-text-muted">Tu plan no incluye campañas de WhatsApp.</p>
        </Card>
      ) : null}
      <p className="mb-3 text-[12px] text-text-faint">
        Solo reciben campañas los clientes que ya te visitaron y aceptaron recibir marketing por WhatsApp. La lista la calcula StylerNow, no se puede
        subir a mano.
      </p>

      {creando ? <FormularioCampana plantillas={plantillasUsables} onCreada={() => setCreando(false)} /> : null}

      {resumen.campanas.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">Todavía no tienes campañas.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {resumen.campanas.map((c) => (
            <TarjetaCampana key={c.id} campana={c} plantilla={resumen.plantillas.find((t) => t.id === c.plantilla_id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FormularioCampana({ plantillas, onCreada }: { plantillas: PlantillaWhatsApp[]; onCreada: () => void }) {
  const { pendiente, error, ejecutar } = useAccion();
  const [nombre, setNombre] = useState("");
  const [plantillaId, setPlantillaId] = useState(plantillas[0]?.id ?? "");
  const [dias, setDias] = useState("");
  const [visitas, setVisitas] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [programada, setProgramada] = useState("");
  const [conteo, setConteo] = useState<{ conTelefono: number; conConsentimiento: number } | null>(null);
  const [errorConteo, setErrorConteo] = useState<string | null>(null);
  const [contando, iniciarConteo] = useTransition();

  const segmento = {
    dias_sin_visita_min: dias ? Number(dias) : null,
    visitas_min: visitas ? Number(visitas) : null,
    etiqueta: etiqueta.trim() || null,
  };

  function contar() {
    setErrorConteo(null);
    iniciarConteo(async () => {
      const r = await contarSegmento(segmento);
      if (r.ok) setConteo(r.data);
      else setErrorConteo(r.error);
    });
  }

  if (plantillas.length === 0) {
    return (
      <Card className="mb-4">
        <p className="text-[12.5px] text-text-muted">
          Primero crea una plantilla de marketing (con las variables nombre del cliente o nombre del negocio, o sin variables).
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-4 flex flex-col gap-3">
      <Input label="Nombre de la campaña" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} />
      <label className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.72px] text-text">Plantilla</span>
        <select
          value={plantillaId}
          onChange={(e) => setPlantillaId(e.target.value)}
          className="min-h-12 border-2 border-border bg-bg px-3 text-[14px] text-text"
        >
          {plantillas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({ESTADO_PLANTILLA[t.estado]?.texto ?? t.estado})
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Sin visitar hace (días)" type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} />
        <Input label="Visitas mínimas" type="number" min={1} value={visitas} onChange={(e) => setVisitas(e.target.value)} />
        <Input label="Etiqueta del CRM" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} maxLength={50} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" loading={contando} onClick={contar}>
          Contar destinatarios
        </Button>
        {conteo ? (
          <p className="text-[12px] text-text-muted">
            {fmt(conteo.conConsentimiento)} recibirían la campaña ({fmt(conteo.conTelefono)} clientes con teléfono en el segmento).
          </p>
        ) : null}
        {errorConteo ? <p className="text-[12px] text-danger">{errorConteo}</p> : null}
      </div>
      <Input label="Fecha y hora de envío" type="datetime-local" value={programada} onChange={(e) => setProgramada(e.target.value)} />
      {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
      <Button
        size="sm"
        className="self-start"
        loading={pendiente}
        disabled={nombre.trim().length < 2 || !plantillaId}
        onClick={() =>
          ejecutar(
            () => crearCampana({ plantillaId, nombre, segmento, programadaAt: programada ? new Date(programada).toISOString() : null }),
            onCreada
          )
        }
      >
        Crear campaña (queda en borrador)
      </Button>
    </Card>
  );
}

function TarjetaCampana({ campana, plantilla }: { campana: CampanaWhatsApp; plantilla?: PlantillaWhatsApp }) {
  const { pendiente, error, aviso, setAviso, ejecutar } = useAccion();
  const e = ESTADO_CAMPANA[campana.estado] ?? { texto: campana.estado, tono: "neutral" as Tono };
  return (
    <li className="border border-border-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-bold text-text">{campana.nombre}</p>
          <p className="text-[11.5px] text-text-faint">
            {plantilla ? plantilla.nombre : "Plantilla"} · {fmt(campana.destinatarios_estimados)} destinatarios estimados · {fecha(campana.programada_at)}
          </p>
        </div>
        <Badge tone={e.tono}>{e.texto}</Badge>
      </div>
      {campana.estado === "BLOQUEADA_SIN_CONEXION" ? (
        <p className="mt-2 text-[12px] font-semibold text-danger">Envío bloqueado: WhatsApp no está conectado. No se envió ningún mensaje.</p>
      ) : null}
      {aviso ? <p className="mt-2 text-[12px] font-semibold text-text">{aviso}</p> : null}
      {error ? <p className="mt-2 text-[11.5px] font-semibold text-danger">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {campana.estado === "BORRADOR" || campana.estado === "BLOQUEADA_SIN_CONEXION" ? (
          <Button
            size="sm"
            loading={pendiente}
            onClick={() =>
              ejecutar(
                () => programarCampana(campana.id),
                (r) => {
                  if (r.ok && r.data.estado === "BLOQUEADA_SIN_CONEXION") setAviso("Envío bloqueado: WhatsApp no está conectado. La campaña quedó guardada.");
                }
              )
            }
          >
            {campana.estado === "BORRADOR" ? "Programar" : "Reintentar programación"}
          </Button>
        ) : null}
        {["BORRADOR", "PROGRAMADA", "BLOQUEADA_SIN_CONEXION"].includes(campana.estado) ? (
          <Button size="sm" variant="ghost" loading={pendiente} onClick={() => ejecutar(() => cancelarCampana(campana.id))}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </li>
  );
}
