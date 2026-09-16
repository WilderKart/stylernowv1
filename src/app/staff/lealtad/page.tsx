import { obtenerContextoStaff } from "@/lib/auth/require-staff";
import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import { obtenerMisReferidosStaff, obtenerSellosOtorgadosPorMi } from "./actions";

export const metadata = { title: "Lealtad" };

export default async function StaffLealtadPage() {
  const contexto = await obtenerContextoStaff();
  if (!contexto) return null;

  const [referidosRes, sellosRes] = await Promise.all([
    obtenerMisReferidosStaff(contexto.negocioId),
    obtenerSellosOtorgadosPorMi(contexto.negocioId),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Lealtad</h1>
      <p className="mb-6 text-[12px] text-text-faint">Tus Referidos y los Sellos otorgados a Clientes que atendiste.</p>

      <section className="mb-8">
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Mis Referidos</h2>
        {referidosRes.ok && referidosRes.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {referidosRes.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-3.5">
                <p className="text-[11.5px] text-text-faint">{new Date(r.createdAt).toLocaleDateString("es-CO")}</p>
                <div className="flex items-center gap-2">
                  <Badge tone={r.estado === "COMPLETADO" ? "success" : "neutral"}>{r.estado}</Badge>
                  {r.recompensaMonto ? <p className="text-[12px] font-bold text-text">{formatCOP(r.recompensaMonto)}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
            Todavía no registraste ningún Cliente referido. Pedile a tu Barbería el link para registrarlos.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Sellos otorgados</h2>
        {sellosRes.ok && sellosRes.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {sellosRes.data.map((s, i) => (
              <li key={i} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
                <p className="text-[12.5px] font-semibold text-text">{s.clienteNombre}</p>
                <p className="text-[11px] text-text-faint">{s.campanaNombre} · {s.sellosActuales}/{s.sellosRequeridos} sellos</p>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-[12.5px] text-text-faint">Sin sellos otorgados todavía en tus Reservas atendidas.</p>
          </Card>
        )}
      </section>
    </main>
  );
}
