import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { requireSuperSU } from "@/lib/auth/require-supersu";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, type EstadoVerificacion } from "@/lib/verificacion/tipos";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioDecision } from "./formulario-decision";

export const metadata = { title: "Expediente de verificación" };

interface Detalle {
  negocio: { id: string; nombre: string; ciudad: string | null; estado: string; plan: string; telefono: string | null; foto_principal_url: string | null } | null;
  verificacion: { estado: EstadoVerificacion; motivo: string | null; enviada_at: string | null; decidida_at: string | null } | null;
  documentos: { id: string; tipo: string; formato: string; bytes: number; subido_at: string; retirado_at: string | null }[];
  eventos: {
    id: number;
    actor_rol: string;
    actor_id: string | null;
    estado_anterior: EstadoVerificacion | null;
    estado_nuevo: EstadoVerificacion;
    motivo: string | null;
    origen: string;
    created_at: string;
  }[];
}

const fecha = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

export default async function ExpedienteVerificacionPage({ params }: PageProps<"/admin/verificaciones/[id]">) {
  await requireSuperSU();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = (await createClient()) as unknown as {
    rpc: (n: string, a: object) => Promise<{ data: Detalle | null; error: { message: string } | null }>;
  };
  const { data } = await supabase.rpc("admin_verificacion_detalle", { p_negocio_id: id });
  if (!data?.negocio) notFound();
  const estado: EstadoVerificacion = data.verificacion?.estado ?? "NO_INICIADA";
  const vigentes = data.documentos.filter((d) => !d.retirado_at);

  return (
    <main className="w-full max-w-4xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <Link href="/admin/verificaciones" className="mb-4 inline-block text-[12px] font-bold text-text underline underline-offset-4">
        ← Todas las verificaciones
      </Link>
      <EncabezadoAdmin seccion="Verificación" titulo="Expediente de" resaltado={data.negocio.nombre + "."} />

      <dl className="mb-6 grid grid-cols-2 gap-3 border-2 border-border p-4 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="sn-label">Estado</dt>
          <dd className="mt-0.5 font-bold text-text">{ETIQUETA_ESTADO[estado]}</dd>
        </div>
        <div>
          <dt className="sn-label">Negocio</dt>
          <dd className="mt-0.5 text-text">{data.negocio.estado.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="sn-label">Plan</dt>
          <dd className="mt-0.5 text-text">{data.negocio.plan}</dd>
        </div>
        <div>
          <dt className="sn-label">Ciudad</dt>
          <dd className="mt-0.5 text-text">{data.negocio.ciudad ?? "—"}</dd>
        </div>
      </dl>

      <section className="mb-8" aria-label="Documentos">
        <h2 className="mb-2 font-display text-[14px] font-bold uppercase text-text">Documentos privados ({vigentes.length})</h2>
        {data.documentos.length === 0 ? (
          <p className="border-2 border-dashed border-border px-3 py-4 text-center text-[12.5px] text-text-muted">El negocio aún no sube documentos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.documentos.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-text">
                    {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
                    {d.retirado_at ? <span className="ml-2 font-mono text-[10px] uppercase text-text-faint">retirado por el negocio</span> : null}
                  </p>
                  <p className="text-[11.5px] text-text-faint">
                    {d.formato.toUpperCase()} · {Math.max(1, Math.round(d.bytes / 1024))} KB · {fecha(d.subido_at)}
                  </p>
                </div>
                <a
                  href={"/api/verificacion/documento/" + d.id}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-2 border-border px-3 py-1.5 text-[11px] font-bold uppercase text-text hover:bg-text hover:text-bg"
                >
                  Abrir (queda registrado)
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FormularioDecision negocioId={data.negocio.id} estado={estado} />

      <section className="mt-8" aria-label="Historial">
        <h2 className="mb-2 font-display text-[14px] font-bold uppercase text-text">Historial de la verificación</h2>
        {data.eventos.length === 0 ? (
          <p className="text-[12.5px] text-text-muted">Sin movimientos todavía.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {data.eventos.map((e) => (
              <li key={e.id} className="border-l-4 border-border pl-3 text-[12.5px]">
                <p className="font-bold text-text">
                  {ETIQUETA_ESTADO[e.estado_anterior ?? "NO_INICIADA"]} → {ETIQUETA_ESTADO[e.estado_nuevo]}
                </p>
                <p className="text-text-faint">
                  {fecha(e.created_at)} · {e.actor_rol === "SUPERSU" ? "SuperSU" : e.actor_rol === "PROPIETARIO" ? "Propietario" : "Sistema"} ·
                  origen {e.origen}
                </p>
                {e.motivo ? <p className="mt-0.5 text-text-muted">Motivo: {e.motivo}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
