import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { requireSuperSU } from "@/lib/auth/require-supersu";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_ESTADO, type EstadoVerificacion } from "@/lib/verificacion/tipos";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Verificaciones" };

interface Fila {
  negocio_id: string;
  nombre: string;
  ciudad: string | null;
  negocio_estado: string;
  verificacion: EstadoVerificacion;
  enviada_at: string | null;
  documentos: number;
}
interface Lista {
  total: number;
  filas: Fila[];
  conteo: Record<string, number>;
}

const FILTROS: { valor: string; etiqueta: string }[] = [
  { valor: "", etiqueta: "Todas" },
  { valor: "EN_REVISION", etiqueta: "En revisión" },
  { valor: "REQUIERE_CORRECCION", etiqueta: "Requieren corrección" },
  { valor: "PENDIENTE_DOCUMENTACION", etiqueta: "Pendientes de documentación" },
  { valor: "VERIFICADA", etiqueta: "Verificadas" },
  { valor: "RECHAZADA", etiqueta: "Rechazadas" },
  { valor: "REVOCADA", etiqueta: "Revocadas" },
  { valor: "NO_INICIADA", etiqueta: "No iniciadas" },
];

export default async function AdminVerificacionesPage({ searchParams }: PageProps<"/admin/verificaciones">) {
  await requireSuperSU();
  const sp = await searchParams;
  const estado = typeof sp.estado === "string" ? sp.estado : "";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";

  const supabase = (await createClient()) as unknown as {
    rpc: (n: string, a: object) => Promise<{ data: Lista | null; error: { message: string } | null }>;
  };
  const { data, error } = await supabase.rpc("admin_verificaciones_listar", { p_estado: estado || null, p_q: q || null, p_limite: 100, p_offset: 0 });
  const lista: Lista = data ?? { total: 0, filas: [], conteo: {} };

  return (
    <main className="w-full max-w-4xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Operación" titulo="Verificación de" resaltado="negocios." />
      <p className="-mt-3 mb-6 max-w-3xl text-[13px] text-text-muted">
        Documentos privados de los negocios y estado de su verificación. Cada lectura de un documento y cada decisión queda en el historial
        con quién, cuándo, estado anterior y nuevo, y motivo. La verificación es independiente de la aprobación del negocio.
      </p>

      <nav aria-label="Filtrar por estado" className="mb-5 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const activo = estado === f.valor;
          const n = f.valor ? lista.conteo[f.valor] : undefined;
          return (
            <Link
              key={f.valor || "todas"}
              href={f.valor ? "/admin/verificaciones?estado=" + f.valor : "/admin/verificaciones"}
              aria-current={activo ? "true" : undefined}
              className={cn(
                "border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide",
                activo ? "border-ink bg-signal text-ink" : "border-border text-text hover:border-text",
              )}
            >
              {f.etiqueta}
              {n !== undefined ? " · " + n : ""}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <p role="alert" className="border-2 border-danger bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
          No pudimos cargar las verificaciones.
        </p>
      ) : lista.filas.length === 0 ? (
        <p className="border-2 border-dashed border-border px-4 py-10 text-center text-[13px] text-text-muted">No hay negocios en este estado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.filas.map((f) => (
            <li key={f.negocio_id}>
              <Link
                href={"/admin/verificaciones/" + f.negocio_id}
                className="flex flex-wrap items-center justify-between gap-3 border-2 border-border p-3.5 hover:border-text"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-text">{f.nombre}</span>
                  <span className="block text-[12px] text-text-faint">
                    {f.ciudad ?? "—"} · {f.documentos} {f.documentos === 1 ? "documento" : "documentos"}
                    {f.enviada_at ? " · enviada " + new Date(f.enviada_at).toLocaleDateString("es-CO") : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wide",
                    f.verificacion === "EN_REVISION" ? "bg-signal text-ink" : f.verificacion === "VERIFICADA" ? "bg-success text-ink" : "border-2 border-border text-text",
                  )}
                >
                  {ETIQUETA_ESTADO[f.verificacion]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
