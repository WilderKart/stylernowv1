import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/card";
import { fechaHoraLarga } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Mis reservas",
  robots: { index: false, follow: false },
};

const TONO = {
  PENDIENTE_PAGO: "neutral",
  CONFIRMADA: "success",
  EN_CURSO: "accent",
  COMPLETADA: "neutral",
  CANCELADA: "danger",
  NO_SHOW: "danger",
} as const;

const ETIQUETA = {
  PENDIENTE_PAGO: "SIN PAGAR",
  CONFIRMADA: "CONFIRMADA",
  EN_CURSO: "EN CURSO",
  COMPLETADA: "COMPLETADA",
  CANCELADA: "CANCELADA",
  NO_SHOW: "NO ASISTIÓ",
} as const;

/** Separa lo que todavía va a pasar de lo que ya pasó, en el momento del render. */
function separarPorMomento<T extends { id: string; hora_inicio: string; estado: string }>(
  reservas: T[]
) {
  const ahora = Date.now();
  const esProxima = (r: T) =>
    new Date(r.hora_inicio).getTime() >= ahora &&
    (r.estado === "CONFIRMADA" || r.estado === "PENDIENTE_PAGO" || r.estado === "EN_CURSO");

  return {
    proximas: reservas.filter(esProxima),
    historial: reservas.filter((r) => !esProxima(r)),
  };
}

export default async function MisReservasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mis-reservas");

  // RLS `reserva_select_cliente` ya devuelve solo las Reservas propias.
  const { data: reservas } = await supabase
    .from("reserva")
    .select(
      `id, estado, hora_inicio, monto_total, monto_sena,
       negocio:negocio_id (nombre),
       sede:sede_id (zona_horaria),
       reserva_servicio (servicio:servicio_id (nombre))`
    )
    .order("hora_inicio", { ascending: false })
    .limit(50);

  const { proximas, historial } = separarPorMomento(reservas ?? []);

  function Fila({ reserva }: { reserva: NonNullable<typeof reservas>[number] }) {
    const negocio = (reserva.negocio as unknown as { nombre: string } | null)?.nombre ?? "—";
    const tz =
      (reserva.sede as unknown as { zona_horaria: string } | null)?.zona_horaria ??
      "America/Bogota";
    const servicios = (reserva.reserva_servicio ?? [])
      .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
      .filter(Boolean)
      .join(" + ");

    return (
      <li>
        <Link
          href={`/reserva/${reserva.id}`}
          className="flex flex-col gap-1.5 rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:border-accent/40"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] font-bold text-text">{negocio}</p>
            <Badge tone={TONO[reserva.estado]}>{ETIQUETA[reserva.estado]}</Badge>
          </div>
          <p className="text-[12.5px] text-text-muted">{servicios}</p>
          <p className="text-[12.5px] capitalize text-text-faint">
            {fechaHoraLarga(reserva.hora_inicio, tz)}
          </p>
          <p className="text-[12.5px] font-semibold text-accent">
            {formatCOP(Number(reserva.monto_total))}
          </p>
        </Link>
      </li>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-16">
      <Header autenticado />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        <h1 className="font-display mb-5 text-[24px] font-bold uppercase text-text">
          Mis reservas
        </h1>

        {(reservas ?? []).length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="mb-1 text-sm font-semibold text-text">Todavía no reservaste nada</p>
            <p className="mb-5 max-w-[280px] text-xs text-text-faint">
              Buscá un negocio y reservá tu primer turno en menos de un minuto.
            </p>
            <Link
              href="/"
              className="rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-bg hover:bg-accent-hover"
            >
              EXPLORAR NEGOCIOS
            </Link>
          </div>
        ) : (
          <>
            {proximas.length > 0 ? (
              <section className="mb-7">
                <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Próximas
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {proximas.map((r) => (
                    <Fila key={r.id} reserva={r} />
                  ))}
                </ul>
              </section>
            ) : null}

            {historial.length > 0 ? (
              <section>
                <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Historial
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {historial.map((r) => (
                    <Fila key={r.id} reserva={r} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
