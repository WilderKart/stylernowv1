import { Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { listarNegocios, obtenerResumenAdmin } from "./actions";

export default async function AdminDashboardPage() {
  const [resResumen, resPendientes] = await Promise.all([
    obtenerResumenAdmin(),
    listarNegocios("PENDIENTE_APROBACION"),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Dashboard global</h1>

      {!resResumen.ok ? (
        <p className="text-[12.5px] font-semibold text-danger">{resResumen.error}</p>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card className="text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Negocios activos</p>
            <p className="mt-1 text-[20px] font-bold text-text">{resResumen.data.negociosActivos}</p>
          </Card>
          <Card className="text-center border-accent/30 bg-accent-soft">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-accent">Pendientes</p>
            <p className="mt-1 text-[20px] font-bold text-text">{resResumen.data.negociosPendientes}</p>
          </Card>
          <Card className="text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Ciudades activas</p>
            <p className="mt-1 text-[20px] font-bold text-text">{resResumen.data.ciudadesActivas}</p>
          </Card>
          <Card className="text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">MRR</p>
            <p className="mt-1 text-[15px] font-bold text-text">{formatCOP(resResumen.data.mrr)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Citas del mes</p>
            <p className="mt-1 text-[20px] font-bold text-text">{resResumen.data.citasCompletadasMes}</p>
          </Card>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold uppercase text-text">Negocios pendientes de aprobar</h2>
          <Link href="/admin/negocios" className="text-[12px] font-bold text-accent">
            Ver todos
          </Link>
        </div>
        {!resPendientes.ok || resPendientes.data.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
            No hay negocios esperando aprobación.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {resPendientes.data.map((n) => (
              <li key={n.id}>
                <Link
                  href="/admin/negocios"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5 hover:border-accent/40"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-text">{n.nombre}</p>
                    <p className="text-[11px] text-text-faint">
                      {n.ciudad} · {n.planCodigo}
                    </p>
                  </div>
                  <p className="text-[11px] text-text-faint">{new Date(n.createdAt).toLocaleDateString("es-CO")}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
