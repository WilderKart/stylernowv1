"use client";

import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  aprobarMemoriaIa,
  comprarPaqueteIa,
  consultarEstadoCompraIa,
  crearPromptIa,
  guardarMemoriaIa,
  historialMemoriaIa,
  olvidarMemoriaIa,
  restaurarVersionMemoriaIa,
  type ConsumoIa,
  type MemoriaIa,
  type PaqueteDisponibleIa,
  type PromptIa,
  type RoiIa,
} from "./actions";

// Debe coincidir con el check constraint de ai_memoria_negocio.categoria
// (migración 064) — vive acá, no en actions.ts, porque un archivo "use
// server" solo puede exportar funciones async.
const CATEGORIAS_MEMORIA_IA = [
  "TONO",
  "PROMOCIONES",
  "CLIENTES_VIP",
  "CAMPANAS_EXITOSAS",
  "HORARIOS",
  "OBJETIVOS",
  "CONFIGURACIONES",
  "APRENDIZAJES",
] as const;

export function VistaAiWorkspace({
  negocioId,
  saldoInicial,
  consumoInicial,
  paquetesIniciales,
  memoriaInicial,
  promptsIniciales,
  roiInicial,
  funcionesHabilitadas,
}: {
  negocioId: string;
  saldoInicial: number;
  consumoInicial: ConsumoIa[];
  paquetesIniciales: PaqueteDisponibleIa[];
  memoriaInicial: MemoriaIa[];
  promptsIniciales: PromptIa[];
  roiInicial: RoiIa | null;
  funcionesHabilitadas: string[];
}) {
  const [saldo] = useState(saldoInicial);
  const [pagoPendienteId, setPagoPendienteId] = useState<string | null>(null);
  const [urlCheckout, setUrlCheckout] = useState<string | null>(null);
  const [comprando, setComprando] = useState<string | null>(null);

  useEffect(() => {
    if (!pagoPendienteId) return;
    const intervalo = setInterval(async () => {
      const res = await consultarEstadoCompraIa(pagoPendienteId);
      if (res.pago === "APROBADO") {
        setPagoPendienteId(null);
        window.location.reload();
      } else if (res.pago === "RECHAZADO") {
        setPagoPendienteId(null);
        toast.error("El pago del paquete de créditos fue rechazado por la pasarela.");
      }
    }, 4000);
    return () => clearInterval(intervalo);
  }, [pagoPendienteId]);

  useEffect(() => {
    if (urlCheckout) window.location.href = urlCheckout;
  }, [urlCheckout]);

  async function onComprar(paqueteId: string) {
    setComprando(paqueteId);
    const res = await comprarPaqueteIa(negocioId, paqueteId);
    setComprando(null);
    if (!res.ok) { toast.error(res.mensaje); return; }
    setPagoPendienteId(res.pagoId);
    setUrlCheckout(res.url);
  }

  function exportarConsumoCsv() {
    const encabezado = "Fecha,Función,Nivel,Créditos consumidos,Saldo restante\n";
    const filas = consumoInicial
      .map((c) => `${new Date(c.createdAt).toISOString()},${c.funcion},${c.nivel},${c.creditosConsumidos},${c.saldoRestante}`)
      .join("\n");
    const blob = new Blob([encabezado + filas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consumo-ia-${negocioId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">IA</h1>
      <p className="mb-6 text-[12px] text-text-faint">
        Créditos, memoria y prompts de IA de tu Negocio — nunca compartidos con otra Barbería.
      </p>

      <section className="mb-8">
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <p className="text-[22px] font-bold text-text">{saldo}</p>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Créditos disponibles</p>
          </Card>
          <Card className="text-center">
            <p className="text-[22px] font-bold text-text">{funcionesHabilitadas.length}</p>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Funciones de IA en tu Plan</p>
          </Card>
        </div>
        {funcionesHabilitadas.length > 0 ? (
          <p className="mt-2 text-[11px] text-text-faint">{funcionesHabilitadas.join(" · ")}</p>
        ) : null}
      </section>

      <section className="mb-8">
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Comprar créditos</h2>
        {paquetesIniciales.length === 0 ? (
          <p className="text-[12px] text-text-faint">No hay paquetes disponibles en este momento.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {paquetesIniciales.map((p) => (
              <Card key={p.id} className="flex flex-col items-center gap-1 text-center">
                <p className="text-[18px] font-bold text-text">{p.creditos}</p>
                <p className="text-[10px] text-text-faint">créditos</p>
                <p className="mb-2 text-[13px] font-semibold text-text">{formatCOP(p.precioCop)}</p>
                <button
                  type="button"
                  disabled={comprando === p.id || !!pagoPendienteId}
                  onClick={() => onComprar(p.id)}
                  className="w-full rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold uppercase text-white disabled:opacity-50"
                >
                  {comprando === p.id ? "Abriendo..." : pagoPendienteId ? "Esperando pago..." : "Comprar"}
                </button>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10.5px] text-text-faint">Para paquetes Enterprise, contactá a soporte — se cotizan manualmente.</p>
      </section>

      <SeccionMemoria negocioId={negocioId} memoriaInicial={memoriaInicial} />
      <SeccionPrompts negocioId={negocioId} promptsIniciales={promptsIniciales} />

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[13px] font-bold uppercase text-text">Historial de consumo</h2>
          {consumoInicial.length > 0 ? (
            <button type="button" onClick={exportarConsumoCsv} className="text-[10.5px] font-bold uppercase text-accent">
              Exportar CSV
            </button>
          ) : null}
        </div>
        {consumoInicial.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Todavía no consumiste créditos de IA.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {consumoInicial.slice(0, 20).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-[12px]">
                <div>
                  <p className="font-semibold text-text">{c.funcion}</p>
                  <p className="text-[10.5px] text-text-faint">{new Date(c.createdAt).toLocaleString("es-CO")}</p>
                </div>
                <span className="font-bold text-danger">-{c.creditosConsumidos}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SeccionRoi roi={roiInicial} />
    </main>
  );
}

function SeccionMemoria({ negocioId, memoriaInicial }: { negocioId: string; memoriaInicial: MemoriaIa[] }) {
  const [memoria, setMemoria] = useState(memoriaInicial);
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [pendiente, iniciarTransicion] = useTransition();
  const [historial, setHistorial] = useState<{ categoria: string; items: MemoriaIa[] } | null>(null);

  function abrirEdicion(categoria: string) {
    const actual = memoria.find((m) => m.categoria === categoria);
    setTexto(actual ? JSON.stringify(actual.contenido, null, 2) : "{}");
    setEditando(categoria);
  }

  function guardar(categoria: string) {
    let contenido: Record<string, unknown>;
    try {
      contenido = JSON.parse(texto);
    } catch {
      toast.error("El contenido debe ser un JSON válido."); return;
    }
    iniciarTransicion(async () => {
      const r = await guardarMemoriaIa(negocioId, categoria, contenido);
      if (!r.ok) { toast.error(r.error); return; }
      setMemoria((prev) => {
        const otras = prev.filter((m) => m.categoria !== categoria);
        return [...otras, { id: "", categoria, contenido, version: (prev.find((m) => m.categoria === categoria)?.version ?? 0) + 1, aprobado: false, createdAt: new Date().toISOString() }];
      });
      setEditando(null);
      toast.success(`Memoria "${categoria}" guardada como nueva versión.`);
    });
  }

  function aprobar(m: MemoriaIa) {
    iniciarTransicion(async () => {
      const r = await aprobarMemoriaIa(m.id);
      if (!r.ok) { toast.error(r.error); return; }
      setMemoria((prev) => prev.map((x) => (x.categoria === m.categoria ? { ...x, aprobado: true } : x)));
    });
  }

  function olvidar(m: MemoriaIa) {
    if (!confirm(`¿Olvidar la memoria de "${m.categoria}"? Esto la borra permanentemente (no se puede deshacer).`)) return;
    iniciarTransicion(async () => {
      const r = await olvidarMemoriaIa(m.id);
      if (!r.ok) { toast.error(r.error); return; }
      setMemoria((prev) => prev.filter((x) => x.categoria !== m.categoria));
    });
  }

  async function verHistorial(categoria: string) {
    const r = await historialMemoriaIa(negocioId, categoria);
    if (!r.ok) { toast.error(r.error); return; }
    setHistorial({ categoria, items: r.data });
  }

  function restaurar(memoriaIdHistorica: string) {
    iniciarTransicion(async () => {
      const r = await restaurarVersionMemoriaIa(memoriaIdHistorica);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Versión restaurada como la nueva vigente.");
      setHistorial(null);
      window.location.reload();
    });
  }

  return (
    <section className="mb-8">
      <h2 className="font-display mb-1 text-[13px] font-bold uppercase text-text">Memoria de IA</h2>
      <p className="mb-3 text-[11px] text-text-faint">
        Lo que la IA recuerda de tu Negocio para personalizar sus respuestas — vos decidís qué guarda, aprobás o hacés olvidar.
      </p>
      <div className="flex flex-col gap-2">
        {CATEGORIAS_MEMORIA_IA.map((categoria) => {
          const actual = memoria.find((m) => m.categoria === categoria);
          return (
            <Card key={categoria}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[12.5px] font-semibold text-text">{categoria}</p>
                  {actual ? (
                    <p className="text-[10.5px] text-text-faint">v{actual.version} {actual.aprobado ? "· aprobada" : "· sin aprobar"}</p>
                  ) : (
                    <p className="text-[10.5px] text-text-faint">Sin datos guardados</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => abrirEdicion(categoria)} className="text-[10.5px] font-bold uppercase text-accent">
                    Editar
                  </button>
                  {actual ? (
                    <>
                      {!actual.aprobado ? (
                        <button type="button" disabled={pendiente} onClick={() => aprobar(actual)} className="text-[10.5px] font-bold uppercase text-success">
                          Aprobar
                        </button>
                      ) : null}
                      <button type="button" onClick={() => verHistorial(categoria)} className="text-[10.5px] font-bold uppercase text-text-muted">
                        Historial
                      </button>
                      <button type="button" disabled={pendiente} onClick={() => olvidar(actual)} className="text-[10.5px] font-bold uppercase text-danger">
                        Olvidar
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              {editando === categoria ? (
                <div className="mt-2">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-bg p-2 font-mono text-[11px] text-text"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={pendiente} onClick={() => guardar(categoria)} className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold uppercase text-white disabled:opacity-50">
                      Guardar nueva versión
                    </button>
                    <button type="button" onClick={() => setEditando(null)} className="text-[11px] font-bold uppercase text-text-faint">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
              {historial?.categoria === categoria ? (
                <ul className="mt-2 flex flex-col gap-1 border-t border-border-subtle pt-2">
                  {historial.items.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">v{h.version} — {new Date(h.createdAt).toLocaleDateString("es-CO")}</span>
                      {h.version !== actual?.version ? (
                        <button type="button" disabled={pendiente} onClick={() => restaurar(h.id)} className="font-bold uppercase text-accent">
                          Restaurar
                        </button>
                      ) : (
                        <Badge tone="accent">Vigente</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function SeccionPrompts({ negocioId, promptsIniciales }: { negocioId: string; promptsIniciales: PromptIa[] }) {
  const [prompts, setPrompts] = useState(promptsIniciales);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("CAMPANAS");
  const [contenido, setContenido] = useState("");
  const [pendiente, iniciarTransicion] = useTransition();

  function crear() {
    if (!nombre.trim() || !contenido.trim()) { toast.error("Completá nombre y contenido."); return; }
    iniciarTransicion(async () => {
      const r = await crearPromptIa(negocioId, "PROPIO", categoria, nombre, contenido);
      if (!r.ok) { toast.error(r.error); return; }
      setPrompts((prev) => [...prev, { id: crypto.randomUUID(), tipo: "PROPIO", categoria, nombre, contenido, variables: [] }]);
      setNombre("");
      setContenido("");
      setCreando(false);
      toast.success("Prompt guardado.");
    });
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-[13px] font-bold uppercase text-text">Biblioteca de prompts</h2>
        <button type="button" onClick={() => setCreando((v) => !v)} className="text-[10.5px] font-bold uppercase text-accent">
          {creando ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>
      {creando ? (
        <Card className="mb-2">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del prompt" className="mb-2 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[12px] text-text" />
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoría" className="mb-2 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[12px] text-text" />
          <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={3} placeholder="Contenido del prompt" className="mb-2 w-full rounded-lg border border-border bg-bg p-2 text-[12px] text-text" />
          <button type="button" disabled={pendiente} onClick={crear} className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold uppercase text-white disabled:opacity-50">
            Guardar
          </button>
        </Card>
      ) : null}
      {prompts.length === 0 ? (
        <p className="text-[12px] text-text-faint">Todavía no tenés prompts guardados.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {prompts.map((p) => (
            <li key={p.id} className="rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-[12px]">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-text">{p.nombre}</p>
                <Badge tone={p.tipo === "OFICIAL" ? "accent" : "neutral"}>{p.tipo}</Badge>
              </div>
              <p className="mt-1 text-[10.5px] text-text-faint">{p.categoria}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SeccionRoi({ roi }: { roi: RoiIa | null }) {
  if (!roi) return null;
  return (
    <section>
      <h2 className="font-display mb-1 text-[13px] font-bold uppercase text-text">ROI de IA</h2>
      <p className="mb-3 text-[11px] text-text-faint">
        Consumo, costo y atribución reales — nunca una estimación inventada. La atribución cuenta Reservas de un Cliente que
        había confirmado una sugerencia de IA en los 30 días previos (Motor de recompensas de Lealtad); el resto de posibles
        señales (campañas por email/WhatsApp, tiempo ahorrado) todavía no tiene una fuente de datos real detrás.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-[18px] font-bold text-text">{roi.creditosConsumidosTotal}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-faint">Créditos consumidos (total)</p>
        </Card>
        <Card className="text-center">
          <p className="text-[18px] font-bold text-text">{roi.campanasEjecutadasIa}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-faint">Campañas asistidas por IA</p>
        </Card>
        <Card className="text-center">
          <p className="text-[18px] font-bold text-text">{roi.conversionesTotal}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-faint">Reservas atribuidas a IA</p>
        </Card>
        <Card className="text-center">
          <p className="text-[18px] font-bold text-text">{formatCOP(roi.montoAtribuidoTotal)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-faint">Monto atribuido a IA</p>
        </Card>
      </div>
      {roi.consumoPorCategoria.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {roi.consumoPorCategoria.map((c) => (
            <li key={c.categoria} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-[12px]">
              <span className="text-text-muted">{c.categoria}</span>
              <span className="font-bold text-text">{c.creditos} créditos</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12px] text-text-faint">
          Sin consumo todavía.
        </p>
      )}
    </section>
  );
}
