"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, TIPOS_DOCUMENTO, type EstadoVerificacion } from "@/lib/verificacion/tipos";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { enviarVerificacionARevision, iniciarVerificacion, retirarDocumentoVerificacion } from "./actions";

export interface MiVerificacion {
  estado: EstadoVerificacion;
  motivo: string | null;
  enviada_at: string | null;
  decidida_at: string | null;
  documentos: { id: string; tipo: string; formato: string; bytes: number; subido_at: string }[];
}

const TONO: Record<EstadoVerificacion, "neutral" | "success" | "danger" | "accent"> = {
  NO_INICIADA: "neutral",
  PENDIENTE_DOCUMENTACION: "accent",
  EN_REVISION: "accent",
  VERIFICADA: "success",
  REQUIERE_CORRECCION: "danger",
  RECHAZADA: "danger",
  REVOCADA: "danger",
};

const NEGOCIO_TEXTO: Record<string, { texto: string; badge: string; tono: "neutral" | "success" | "danger" | "accent" }> = {
  PENDIENTE_APROBACION: { texto: "Esperando aprobación del equipo de StylerNow", badge: "EN REVISIÓN", tono: "accent" },
  ACTIVO: { texto: "Aprobado y activo", badge: "APROBADO", tono: "success" },
  SUSPENDIDO: { texto: "Suspendido", badge: "SUSPENDIDO", tono: "danger" },
  RECHAZADO: { texto: "Rechazado", badge: "RECHAZADO", tono: "danger" },
  CANCELADO: { texto: "Cancelado", badge: "CANCELADO", tono: "danger" },
};

const GRUPOS = Array.from(new Set(TIPOS_DOCUMENTO.map((t) => t.grupo)));

function tamano(b: number) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function VistaVerificacion({
  negocioId,
  inicial,
  almacenamiento,
  estadoNegocio,
}: {
  negocioId: string;
  inicial: MiVerificacion;
  estadoNegocio: string | null;
  almacenamiento: boolean;
}) {
  const router = useRouter();
  const v = inicial;
  const [tipo, setTipo] = useState<string>(TIPOS_DOCUMENTO[0].valor);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = v.estado === "PENDIENTE_DOCUMENTACION" || v.estado === "REQUIERE_CORRECCION";

  async function accion(nombre: string, f: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setOcupado(nombre);
    setError(null);
    const r = await f();
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setOcupado("subir");
    setError(null);
    const datos = new FormData();
    datos.set("negocioId", negocioId);
    datos.set("tipo", tipo);
    datos.set("archivo", archivo);
    try {
      const res = await fetch("/api/verificacion/documento", { method: "POST", body: datos });
      const r = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(r.error ?? "No pudimos subir el documento.");
      else router.refresh();
    } catch {
      setError("No pudimos subir el documento. Revisa tu conexión.");
    }
    setOcupado(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <ShieldCheck className="!size-8 text-accent" aria-hidden />
          <h1 className="font-display text-[clamp(26px,8vw,36px)] font-bold uppercase leading-none text-text">
            Verifica <span className="text-accent">tu negocio</span>
          </h1>
        </div>
        <p className="text-[14px] leading-relaxed text-text-muted">
          Aumenta la confianza de tus clientes demostrando que tu establecimiento existe y que su información ha sido comprobada por
          StylerNow. Es gratis y no bloquea el uso de tu panel.
        </p>
      </header>

      {estadoNegocio ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="sn-label">Tu negocio en StylerNow</p>
            <p className="mt-1 text-[15px] font-semibold text-text">{NEGOCIO_TEXTO[estadoNegocio]?.texto ?? estadoNegocio}</p>
          </div>
          <Badge tone={NEGOCIO_TEXTO[estadoNegocio]?.tono ?? "neutral"}>{NEGOCIO_TEXTO[estadoNegocio]?.badge ?? estadoNegocio}</Badge>
        </Card>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="sn-label">Insignia de verificación (documentos)</p>
          <p className="mt-1 text-[15px] font-semibold text-text">{ETIQUETA_ESTADO[v.estado]}</p>
          {v.estado === "VERIFICADA" && v.decidida_at ? (
            <p className="mt-0.5 text-[12px] text-text-faint">Aprobada el {new Date(v.decidida_at).toLocaleDateString("es-CO")}</p>
          ) : null}
        </div>
        <Badge tone={TONO[v.estado]}>{v.estado === "VERIFICADA" ? "APROBADA" : v.estado.replaceAll("_", " ")}</Badge>
      </Card>

      {estadoNegocio === "ACTIVO" && v.estado !== "VERIFICADA" ? (
        <p className="text-[12.5px] leading-relaxed text-text-muted">
          Tu negocio ya está aprobado y puede operar. La insignia de verificación es un paso aparte, opcional y sin costo: el equipo revisa tus
          documentos y, si todo está bien, tu perfil público muestra la marca de «Verificado».
        </p>
      ) : null}

      {v.motivo ? (
        <Card className="border-danger bg-danger-soft">
          <p className="text-[12.5px] font-bold text-danger">Mensaje del equipo de StylerNow</p>
          <p className="mt-1 text-[13px] leading-relaxed text-text">{v.motivo}</p>
        </Card>
      ) : null}

      <Card>
        <p className="font-display text-[14px] font-bold uppercase text-text">Qué se pide y qué no se publica</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-text-muted">
          <li>
            <b className="text-text">Fotografía pública de la fachada:</b> la subiste al registrarte y es la que ven tus clientes. Es distinta de estos
            documentos.
          </li>
          <li>
            <b className="text-text">Documentos de verificación:</b> son privados. No aparecen en tu perfil ni tienen enlace público; solo tú y el equipo
            de StylerNow pueden verlos, y cada consulta queda registrada.
          </li>
          <li>Si eres independiente y no tienes documentos empresariales, usa «Otro soporte de tu actividad»: el equipo lo evalúa.</li>
        </ul>
      </Card>

      {v.estado === "NO_INICIADA" ? (
        <Button size="lg" loading={ocupado === "iniciar"} onClick={() => accion("iniciar", () => iniciarVerificacion(negocioId))}>
          INICIAR VERIFICACIÓN
        </Button>
      ) : null}

      {v.estado !== "NO_INICIADA" ? (
        <section className="flex flex-col gap-3" aria-label="Documentos">
          <h2 className="font-display text-[14px] font-bold uppercase text-text">Tus documentos</h2>
          {v.documentos.length === 0 ? (
            <p className="border-2 border-dashed border-border px-3 py-4 text-center text-[12.5px] text-text-muted">Aún no subes documentos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {v.documentos.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-text">{ETIQUETA_TIPO[d.tipo] ?? d.tipo}</p>
                    <p className="text-[11.5px] text-text-faint">
                      {d.formato.toUpperCase()} · {tamano(d.bytes)} · {new Date(d.subido_at).toLocaleDateString("es-CO")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/api/verificacion/documento/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-2 border-border px-3 py-1.5 text-[11px] font-bold uppercase text-text hover:bg-text hover:text-bg"
                    >
                      Ver
                    </a>
                    {editable ? (
                      <Button
                        size="sm"
                        variant="danger"
                        loading={ocupado === d.id}
                        onClick={() => accion(d.id, () => retirarDocumentoVerificacion(d.id))}
                      >
                        Retirar
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editable ? (
            <div className="flex flex-col gap-3 border-2 border-border p-4">
              <label className="flex flex-col gap-2">
                <span className="sn-label">Tipo de documento</span>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="min-h-12 w-full border-2 border-border bg-bg px-3 text-[14px] text-text outline-none focus:shadow-hard"
                >
                  {GRUPOS.map((g) => (
                    <optgroup key={g} label={g}>
                      {TIPOS_DOCUMENTO.filter((t) => t.grupo === g).map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.etiqueta}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {almacenamiento ? (
                <label className="flex cursor-pointer flex-col gap-2">
                  <span className="sn-label">Archivo (PDF, JPG, PNG o WebP · máx. 8 MB)</span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={ocupado !== null}
                    onChange={(e) => {
                      void subir(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                    className="block w-full text-[13px] file:mr-3 file:border-2 file:border-ink file:bg-signal file:px-3 file:py-2 file:font-mono file:text-[11px] file:font-bold file:uppercase file:text-ink"
                  />
                </label>
              ) : (
                <p className="text-[12.5px] text-text-muted">
                  La carga de documentos no está disponible por ahora. Vuelve a intentarlo más tarde.
                </p>
              )}
              {ocupado === "subir" ? <p className="text-[12px] text-text-faint">Subiendo…</p> : null}
            </div>
          ) : null}

          {editable ? (
            <Button
              size="lg"
              disabled={v.documentos.length === 0}
              loading={ocupado === "enviar"}
              onClick={() => accion("enviar", () => enviarVerificacionARevision(negocioId))}
            >
              ENVIAR A REVISIÓN
            </Button>
          ) : null}
          {v.estado === "EN_REVISION" ? (
            <p className="text-[12.5px] text-text-muted">
              Recibimos tu solicitud el {v.enviada_at ? new Date(v.enviada_at).toLocaleDateString("es-CO") : "—"}. Te avisaremos cuando haya una
              decisión.
            </p>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="border-2 border-danger bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
