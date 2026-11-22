"use client";

import { Caja, Insignia, TituloCaja, Vacio } from "@/app/admin/_componentes/ui-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  buscarEvidencias,
  detalleEvidencia,
  exportarExpediente,
  verificarCadena,
  type DetalleEvidencia,
  type FilaEvidencia,
  type FiltrosEvidencias,
} from "./actions";
import { ACCIONES, CATEGORIAS, POR_PAGINA } from "./constantes";

const FECHA = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "medium", timeZone: "America/Bogota" });
const f = (iso: string | null) => (iso ? FECHA.format(new Date(iso)) : "—");

const TONO_ACCION: Record<string, "neutro" | "acento" | "ok" | "alerta" | "peligro"> = {
  ACEPTA: "ok",
  ACEPTA_TACITA: "alerta",
  RECHAZA: "peligro",
  REVOCA: "peligro",
  MODIFICA: "acento",
  SOLICITA: "acento",
};

const SELECT = "h-11 w-full border-2 border-border bg-bg px-3 text-[13px] text-text";

export function VistaEvidencias() {
  const [filtros, setFiltros] = useState<FiltrosEvidencias>({});
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ total: number; filas: FilaEvidencia[] } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleEvidencia | null>(null);
  const [cadena, setCadena] = useState<string | null>(null);

  function campo<K extends keyof FiltrosEvidencias>(k: K, v: string) {
    setFiltros((prev) => ({ ...prev, [k]: v === "" ? undefined : v }));
  }

  async function buscar(nuevaPagina = 1, base: FiltrosEvidencias = filtros) {
    setCargando(true);
    setError(null);
    const res = await buscarEvidencias({ ...base, pagina: nuevaPagina });
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setPagina(nuevaPagina);
    setResultado(res.data);
  }

  async function verHistorial(usuarioId: string) {
    const base = { usuario: usuarioId };
    setFiltros(base);
    setDetalle(null);
    await buscar(1, base);
  }

  async function abrir(id: string) {
    setError(null);
    const res = await detalleEvidencia(id);
    if (!res.ok) return setError(res.error);
    setDetalle(res.data);
  }

  async function onVerificarCadena() {
    setCadena("Verificando…");
    const res = await verificarCadena();
    if (!res.ok) return setCadena(res.error);
    setCadena(
      res.data.problemas.length === 0
        ? `Cadena íntegra: ${res.data.total} evidencias verificadas (${f(res.data.verificado_at)}).`
        : `ALERTA: ${res.data.problemas.length} problema(s) — ${res.data.problemas
            .slice(0, 5)
            .map((p) => `#${p.secuencia} ${p.problema}`)
            .join(", ")}`
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Caja>
        <TituloCaja>Buscar</TituloCaja>
        <form
          className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void buscar(1);
          }}
        >
          <label className="flex flex-col gap-1 text-[12px] font-bold text-text sm:col-span-2">
            Correo del titular
            <Input type="email" value={filtros.correo ?? ""} onChange={(e) => campo("correo", e.target.value)} placeholder="titular@correo.com" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-text">
            Categoría
            <select className={SELECT} value={filtros.categoria ?? ""} onChange={(e) => campo("categoria", e.target.value)}>
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-text">
            Acción
            <select className={SELECT} value={filtros.accion ?? ""} onChange={(e) => campo("accion", e.target.value)}>
              <option value="">Todas</option>
              {ACCIONES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-text">
            Desde
            <Input type="date" value={filtros.desde ?? ""} onChange={(e) => campo("desde", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-text">
            Hasta
            <Input type="date" value={filtros.hasta ?? ""} onChange={(e) => campo("hasta", e.target.value)} />
          </label>
          {filtros.usuario ? (
            <p className="m-0 text-[12px] text-text-muted sm:col-span-2">
              Historial de un titular ({filtros.usuario.slice(0, 8)}…).{" "}
              <button type="button" className="font-bold underline" onClick={() => setFiltros((p) => ({ ...p, usuario: undefined }))}>
                Quitar
              </button>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" loading={cargando}>
              Buscar
            </Button>
            <Button type="button" variant="secondary" onClick={onVerificarCadena}>
              Verificar integridad de la cadena
            </Button>
          </div>
          {cadena ? <p className="m-0 text-[12px] text-text sm:col-span-2" role="status">{cadena}</p> : null}
          {error ? (
            <p className="m-0 text-[12px] text-danger sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </Caja>

      {detalle ? <Detalle detalle={detalle} onCerrar={() => setDetalle(null)} onHistorial={verHistorial} /> : null}

      {resultado ? (
        <Caja>
          <TituloCaja extra={<span className="font-mono text-[11px] text-text-muted">{resultado.total} resultado(s)</span>}>Historial</TituloCaja>
          {resultado.filas.length === 0 ? (
            <div className="p-4 sm:p-5">
              <Vacio>Sin evidencias para estos filtros.</Vacio>
            </div>
          ) : (
            <ul className="flex flex-col divide-y-2 divide-border">
              {resultado.filas.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => abrir(e.id)} className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-surface sm:px-5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-text-faint">#{e.secuencia}</span>
                      <Insignia tono={TONO_ACCION[e.accion] ?? "neutro"}>{e.accion}</Insignia>
                      <span className="text-[13px] font-bold text-text">{e.documento}</span>
                      {e.version ? <span className="font-mono text-[11px] text-text-muted">v{e.version}</span> : null}
                      {e.importado ? <Insignia>IMPORTADA</Insignia> : null}
                    </span>
                    <span className="truncate text-[12px] text-text-muted">
                      {f(e.ocurrido_at)} · {e.correo ?? "sin cuenta"} · {e.rol}
                      {e.negocio ? ` · ${e.negocio}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {resultado.total > POR_PAGINA ? (
            <div className="flex items-center justify-between gap-2 p-4 sm:p-5">
              <Button variant="secondary" size="sm" disabled={pagina <= 1 || cargando} onClick={() => buscar(pagina - 1)}>
                Anterior
              </Button>
              <span className="font-mono text-[11px] text-text-muted">
                Página {pagina} de {Math.ceil(resultado.total / POR_PAGINA)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagina * POR_PAGINA >= resultado.total || cargando}
                onClick={() => buscar(pagina + 1)}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </Caja>
      ) : null}
    </div>
  );
}

function Detalle({
  detalle: d,
  onCerrar,
  onHistorial,
}: {
  detalle: DetalleEvidencia;
  onCerrar: () => void;
  onHistorial: (usuarioId: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [exportando, setExportando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const integra = d.verificacion.contenido_ok && d.verificacion.texto_ok && d.verificacion.enlace_ok;

  async function exportar() {
    if (!d.usuario_id) return;
    setExportando(true);
    setMensaje(null);
    const res = await exportarExpediente(d.usuario_id, motivo);
    setExportando(false);
    if (!res.ok) return setMensaje(res.error);
    const url = URL.createObjectURL(new Blob([res.data.contenido], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.nombre;
    a.click();
    URL.revokeObjectURL(url);
    setMensaje(`Descargado. SHA-256 del archivo: ${res.data.sha256}`);
  }

  return (
    <Caja destacada>
      <TituloCaja
        extra={
          <button type="button" onClick={onCerrar} className="font-mono text-[11px] font-bold uppercase text-text hover:text-accent">
            Cerrar
          </button>
        }
      >
        Evidencia #{d.secuencia}
      </TituloCaja>
      <div className="flex flex-col gap-3 p-4 text-[13px] sm:p-5">
        <p className="m-0 flex flex-wrap gap-2">
          <Insignia tono={integra ? "ok" : "peligro"}>{integra ? "HUELLA VERIFICADA" : "HUELLA NO COINCIDE"}</Insignia>
          <Insignia tono={TONO_ACCION[d.accion] ?? "neutro"}>{d.accion}</Insignia>
          <Insignia>{d.categoria}</Insignia>
        </p>
        <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[180px_1fr]">
          <Dato t="Titular">{d.correo ?? d.usuario_id ?? "—"} ({d.rol})</Dato>
          <Dato t="Negocio">{d.negocio ?? "—"}</Dato>
          <Dato t="Documento">
            {d.documento} {d.version ? `v${d.version}` : ""}
          </Dato>
          <Dato t="Finalidad">{d.finalidad ?? "—"}</Dato>
          <Dato t="Canal">{d.canal ?? "—"}</Dato>
          <Dato t="Ocurrió">{f(d.ocurrido_at)}</Dato>
          <Dato t="Registrada">{f(d.registrado_at)}</Dato>
          <Dato t="Origen">{d.importado ? `Importada de ${d.fuente_tabla}` : (d.fuente_tabla ?? "—")}</Dato>
          {d.relacionado_con ? <Dato t="Relacionada con">{d.relacionado_con}</Dato> : null}
          <Dato t="Huella">
            <span className="break-all font-mono text-[11px]">{d.hash}</span>
          </Dato>
          <Dato t="Huella del texto">
            <span className="break-all font-mono text-[11px]">{d.texto_sha256 ?? "—"}</span>
          </Dato>
        </dl>
        <div>
          <p className="m-0 mb-1 text-[12px] font-bold text-text">Texto exacto mostrado al titular</p>
          {d.texto ? (
            <blockquote className="m-0 whitespace-pre-wrap border-l-4 border-border bg-surface p-3 text-[13px] text-text">{d.texto}</blockquote>
          ) : (
            <p className="m-0 text-[12px] text-text-muted">No consta el texto: solo la versión del documento (evidencia anterior al repositorio).</p>
          )}
        </div>
        <p className="m-0 text-[12px] text-text-muted">No se recolectan dirección IP ni navegador (decisión F).</p>

        {d.usuario_id ? (
          <div className="flex flex-col gap-2 border-t-2 border-border pt-3">
            <Button variant="secondary" size="sm" className="self-start" onClick={() => onHistorial(d.usuario_id!)}>
              Ver historial completo del titular
            </Button>
            <label className="flex flex-col gap-1 text-[12px] font-bold text-text">
              Motivo de la exportación (queda en Auditoría)
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Ej.: solicitud del titular radicada el …" />
            </label>
            <Button size="sm" className="self-start" loading={exportando} disabled={motivo.trim().length < 10} onClick={exportar}>
              Descargar expediente del titular
            </Button>
            {mensaje ? <p className="m-0 break-all text-[12px] text-text">{mensaje}</p> : null}
          </div>
        ) : null}
      </div>
    </Caja>
  );
}

function Dato({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[12px] font-bold text-text-muted">{t}</dt>
      <dd className="m-0 min-w-0 text-text">{children}</dd>
    </>
  );
}
