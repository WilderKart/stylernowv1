import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";

/**
 * Anticipos por transferencia directa de las citas de HOY, separados para cuadrar caja sin confusión:
 * VERIFICADOS (el dueño confirmó que el dinero llegó) vs POR VERIFICAR (reportados con soporte, aún sin confirmar).
 * Es informativo: ese dinero ya está en la cuenta del negocio, no en la caja física.
 */
export async function AnticiposDirectosDelDia({ negocioId, sedeId }: { negocioId: string; sedeId: string | null }) {
  const supabase = await createClient();
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const inicio = new Date(`${dia}T00:00:00-05:00`);
  const fin = new Date(inicio.getTime() + 24 * 3_600_000);

  let q = supabase
    .from("reserva")
    .select("id")
    .eq("negocio_id", negocioId)
    .gte("hora_inicio", inicio.toISOString())
    .lt("hora_inicio", fin.toISOString())
    .in("estado", ["CONFIRMADA", "EN_CURSO", "COMPLETADA"]);
  if (sedeId) q = q.eq("sede_id", sedeId);
  const { data: citas } = await q;
  const ids = (citas ?? []).map((c) => c.id);
  if (ids.length === 0) return null;

  const { data: pagos } = await supabase
    .from("pago_reserva")
    .select("estado, monto_reportado")
    .eq("negocio_id", negocioId)
    .eq("metodo", "TRANSFERENCIA_DIRECTA")
    .in("reserva_id", ids);
  const filas = pagos ?? [];
  const suma = (estado: string) => filas.filter((f) => f.estado === estado).reduce((a, f) => a + Number(f.monto_reportado), 0);
  const cuenta = (estado: string) => filas.filter((f) => f.estado === estado).length;
  if (filas.length === 0) return null;

  return (
    <section className="mb-5 border-2 border-border p-4" aria-label="Anticipos por transferencia directa de hoy">
      <h2 className="text-[13px] font-bold uppercase">Anticipos directos de hoy</h2>
      <dl className="mt-2 flex flex-col gap-1 text-[13px]">
        <div className="flex justify-between"><dt>Anticipos verificados ({cuenta("VERIFICADO")})</dt><dd className="font-bold">{formatCOP(suma("VERIFICADO"))}</dd></div>
        <div className="flex justify-between"><dt>Transferencias por verificar ({cuenta("REPORTADO")})</dt><dd className="font-bold">{formatCOP(suma("REPORTADO"))}</dd></div>
      </dl>
      <p className="sn-meta mt-2">Ese dinero entró a tu cuenta, no a la caja física. Verifica los pendientes en «Pagos directos».</p>
    </section>
  );
}
