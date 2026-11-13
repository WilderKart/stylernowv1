"use client";

import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { diferencias, type EventoAuditoriaDetalle, type FiltrosAuditoria, type PaginaAuditoria } from "@/lib/auditoria/listado";
import { useState, useTransition } from "react";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export interface NegocioOpcion {
  id: string;
  nombre: string;
}

type FiltrosVisor = FiltrosAuditoria & { negocio?: string };

const ORIGENES: Record<string, string> = {
  PANEL: "Panel",
  API: "API directa",
  SISTEMA: "Sistema",
  SQL: "SQL",
};

const ACTORES: Record<string, string> = {
  SUPERSU: "SuperSU",
  BARBERIA: "Dueño",
  GUARDIAN: "Guardian",
  STAFF: "Staff",
  CLIENTE: "Cliente",
  SISTEMA: "Sistema",
};

/**
 * Visor de auditoría compartido por /admin/auditoria y /panel/auditoria. No decide permisos: cada
 * página le pasa su propia server action, que valida la sesión y llama a `auditoria_listar`.
 */
export function VisorAuditoria({
  inicial,
  errorInicial,
  entidades,
  cargar,
  buscarNegocios,
}: {
  inicial: PaginaAuditoria | null;
  errorInicial: string | null;
  entidades: string[];
  cargar: (filtros: FiltrosVisor) => Promise<Resultado<PaginaAuditoria>>;
  /** Solo en /admin: habilita el filtro por negocio. */
  buscarNegocios?: (texto: string) => Promise<Resultado<NegocioOpcion[]>>;
}) {
  const [pagina, setPagina] = useState<PaginaAuditoria | null>(inicial);
  const [error, setError] = useState(errorInicial);
  const [cargando, iniciar] = useTransition();

  const [entidad, setEntidad] = useState("");
  const [accion, setAccion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [negocio, setNegocio] = useState<NegocioOpcion | null>(null);
  const [textoNegocio, setTextoNegocio] = useState("");
  const [opciones, setOpciones] = useState<NegocioOpcion[]>([]);

  function consultar(numero: number, negocioElegido: NegocioOpcion | null = negocio) {
    iniciar(async () => {
      setError(null);
      const res = await cargar({
        entidad,
        accion,
        desde,
        hasta,
        pagina: numero,
        ...(buscarNegocios ? { negocio: negocioElegido?.id } : {}),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPagina(res.data);
    });
  }

  async function onBuscarNegocio(texto: string) {
    setTextoNegocio(texto);
    if (!buscarNegocios || texto.trim().length < 2) {
      setOpciones([]);
      return;
    }
    const res = await buscarNegocios(texto);
    setOpciones(res.ok ? res.data : []);
  }

  function limpiar() {
    setEntidad("");
    setAccion("");
    setDesde("");
    setHasta("");
    setNegocio(null);
    setTextoNegocio("");
    setOpciones([]);
  }

  const eventos = pagina?.eventos ?? [];
  const numero = pagina?.pagina ?? 1;

  return (
    <div>
      <form
        className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          consultar(1);
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="aud-entidad" className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase">
            Entidad
          </label>
          <select
            id="aud-entidad"
            value={entidad}
            onChange={(e) => setEntidad(e.target.value)}
            className="min-h-12 w-full border-2 border-border bg-bg px-3 text-[15px] text-text outline-none focus:shadow-hard"
          >
            <option value="">Todas</option>
            {entidades.map((e) => (
              <option key={e} value={e}>
                {e.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <Input label="Acción contiene" placeholder="Ej.: ESTADO, PRECIO" maxLength={80} value={accion} onChange={(e) => setAccion(e.target.value)} />
        <Input label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />

        {buscarNegocios ? (
          <div className="relative sm:col-span-2">
            {negocio ? (
              <div className="flex items-center justify-between gap-3 border-2 border-border px-3 py-2.5">
                <p className="text-[13px] font-semibold text-text">Negocio: {negocio.nombre}</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNegocio(null)}>
                  Quitar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  label="Negocio"
                  placeholder="Escribe al menos 2 letras del nombre"
                  maxLength={80}
                  value={textoNegocio}
                  onChange={(e) => onBuscarNegocio(e.target.value)}
                />
                {opciones.length > 0 ? (
                  <ul className="absolute z-10 mt-1 w-full border-2 border-border bg-bg">
                    {opciones.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-[13px] text-text hover:bg-surface"
                          onClick={() => {
                            setNegocio(o);
                            setOpciones([]);
                            setTextoNegocio("");
                          }}
                        >
                          {o.nombre}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" size="sm" loading={cargando}>
            Filtrar
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={limpiar}>
            Limpiar
          </Button>
        </div>
        <p className="text-[11px] text-text-faint sm:col-span-2">Las fechas se toman en hora de Colombia.</p>
      </form>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {cargando && !pagina ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : eventos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          No hay eventos con esos filtros.
        </p>
      ) : (
        <ul className={`flex flex-col gap-2 ${cargando ? "opacity-60" : ""}`}>
          {eventos.map((e) => (
            <FilaEvento key={e.id} evento={e} mostrarNegocio={Boolean(buscarNegocios)} />
          ))}
        </ul>
      )}

      {pagina && (numero > 1 || pagina.hayMas) ? (
        <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" size="sm" variant="secondary" disabled={numero <= 1 || cargando} onClick={() => consultar(numero - 1)}>
            Anterior
          </Button>
          <span className="font-mono text-[12px] text-text-muted">Página {numero}</span>
          <Button type="button" size="sm" variant="secondary" disabled={!pagina.hayMas || cargando} onClick={() => consultar(numero + 1)}>
            Siguiente
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function FilaEvento({ evento: e, mostrarNegocio }: { evento: EventoAuditoriaDetalle; mostrarNegocio: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const cambios = diferencias(e.antes, e.despues);
  const tipoCambio = e.antes && e.despues ? "cambio" : e.despues ? "creacion" : e.antes ? "eliminacion" : null;

  return (
    <li className="rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold break-words text-text">{e.accion.replaceAll("_", " ")}</p>
        <Badge tone="neutral">{e.entidadTipo}</Badge>
      </div>
      <p className="mt-1 text-[11px] break-words text-text-faint">
        {ACTORES[e.actorTipo] ?? e.actorTipo}
        {e.actorNombre ? ` (${e.actorNombre})` : ""}
        {mostrarNegocio && e.negocioNombre ? ` · ${e.negocioNombre}` : ""} · {new Date(e.createdAt).toLocaleString("es-CO")}
        {e.origen ? ` · ${ORIGENES[e.origen] ?? e.origen}` : ""}
      </p>
      {e.motivo ? <p className="mt-1 text-[12px] text-text">Motivo: {e.motivo}</p> : null}

      {cambios.length > 0 || e.requestId || e.entidadId ? (
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
          className="mt-1.5 font-mono text-[11px] font-bold tracking-[0.5px] text-accent uppercase"
        >
          {abierto ? "Ocultar detalle" : `Ver detalle${cambios.length ? ` (${cambios.length} campo${cambios.length === 1 ? "" : "s"})` : ""}`}
        </button>
      ) : null}

      {abierto ? (
        <div className="mt-2 flex flex-col gap-2">
          {cambios.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-collapse text-[11.5px]">
                <thead>
                  <tr className="text-left text-text-muted">
                    <th className="border-b border-border-subtle py-1 pr-2 font-semibold">Campo</th>
                    {tipoCambio !== "creacion" ? <th className="border-b border-border-subtle py-1 pr-2 font-semibold">Antes</th> : null}
                    {tipoCambio !== "eliminacion" ? <th className="border-b border-border-subtle py-1 font-semibold">Después</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {cambios.map((c) => (
                    <tr key={c.campo} className="align-top">
                      <td className="border-b border-border-subtle py-1 pr-2 font-mono text-text">{c.campo}</td>
                      {tipoCambio !== "creacion" ? (
                        <td className="border-b border-border-subtle py-1 pr-2 break-all text-danger">{c.antes}</td>
                      ) : null}
                      {tipoCambio !== "eliminacion" ? (
                        <td className="border-b border-border-subtle py-1 break-all text-success">{c.despues}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="font-mono text-[10.5px] break-all text-text-faint">
            {e.entidadId ? `id: ${e.entidadId}` : ""}
            {e.requestId ? `${e.entidadId ? " · " : ""}petición: ${e.requestId}` : ""}
          </p>
        </div>
      ) : null}
    </li>
  );
}
