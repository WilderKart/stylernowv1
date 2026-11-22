import { PanelNav } from "@/components/panel/panel-nav";
import { Card } from "@/components/ui/card";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { fechaHoraLarga } from "@/lib/formato";
import { obtenerEstadoOperativo } from "@/lib/suscripcion/estado-operativo";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ListaCitasPendientes, type CitaPendiente } from "./lista-citas";

export const metadata = { title: "Cumplimiento de citas" };

type FilaReserva = {
  id: string;
  estado: string;
  hora_inicio: string;
  monto_total: number;
  cliente: { nombre: string } | null;
  reserva_servicio: { servicio: { nombre: string } | null }[] | null;
};

const SELECT = `id, estado, hora_inicio, monto_total,
  cliente:cliente_id (nombre),
  reserva_servicio (servicio:servicio_id (nombre))`;

function aCita(r: FilaReserva): CitaPendiente {
  return {
    id: r.id,
    horaInicio: r.hora_inicio,
    estado: r.estado,
    cliente: r.cliente?.nombre ?? "Cliente",
    servicios: (r.reserva_servicio ?? []).map((x) => x.servicio?.nombre).filter(Boolean).join(" + "),
    monto: r.monto_total,
  };
}

/**
 * Pantalla de «cumplimiento de citas pendientes» (migración 164). Con la suscripción restringida el negocio no puede recibir ni modificar
 * operaciones nuevas, pero SÍ honrar lo ya confirmado: aquí ve sus citas confirmadas (completables), el histórico y el camino a pagar.
 * Nada se oculta ni se elimina. El alcance lo da RLS (Guardian solo ve su sede); el estado, la base (`negocio_estado_operativo`).
 */
export default async function CumplimientoPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/cumplimiento");
  const negocioId = contexto.negocioId!;
  const supabase = await createClient();
  const estado = await obtenerEstadoOperativo(negocioId);

  let pendientesQ = supabase.from("reserva").select(SELECT).eq("negocio_id", negocioId).in("estado", ["CONFIRMADA", "EN_CURSO"]).order("hora_inicio", { ascending: true }).limit(200);
  let historicoQ = supabase.from("reserva").select(SELECT).eq("negocio_id", negocioId).in("estado", ["COMPLETADA", "CANCELADA", "NO_SHOW"]).order("hora_inicio", { ascending: false }).limit(25);
  if (contexto.rol === "GUARDIAN" && contexto.sedeId) {
    pendientesQ = pendientesQ.eq("sede_id", contexto.sedeId);
    historicoQ = historicoQ.eq("sede_id", contexto.sedeId);
  }
  const [pendientesRes, historicoRes] = await Promise.all([pendientesQ, historicoQ]);
  const pendientes = ((pendientesRes.data ?? []) as unknown as FilaReserva[]).map(aCita);
  const historico = ((historicoRes.data ?? []) as unknown as FilaReserva[]).map(aCita);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
        <h1 className="font-display mb-1 text-[24px] font-bold uppercase text-text">Cumplimiento de citas</h1>
        <p className="mb-5 text-[12.5px] text-text-muted">
          {estado.operativo
            ? "Tu suscripción está al día. Aquí ves las citas confirmadas que tienes por cumplir."
            : "Tu suscripción está restringida: no recibes reservas nuevas ni puedes modificar servicios, disponibilidad, equipo ni precios. Aquí cumples las citas que ya estaban confirmadas; tus datos y tu histórico se conservan."}
        </p>

        {!estado.operativo && contexto.rol === "BARBERIA" && estado.puedePagar ? (
          <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-text">Paga tu plan para reactivar todas las funciones al instante.</p>
            <Link href="/panel/suscripcion" className="sn-btn sn-btn--primary">
              <span>Pagar y reactivar</span>
            </Link>
          </Card>
        ) : null}

        <h2 className="font-display mb-3 text-[16px] font-bold uppercase text-text">Citas confirmadas por cumplir ({pendientes.length})</h2>
        <ListaCitasPendientes citas={pendientes} puedeActuar />
        <p className="mt-3 text-[11.5px] text-text-faint">
          Cada profesional inicia y finaliza su atención desde su agenda ({" "}
          <Link href="/staff/agenda" className="underline">
            Mi agenda
          </Link>{" "}
          ). Las citas no se pueden mover a otra fecha mientras la suscripción esté restringida.
        </p>

        <h2 className="font-display mb-3 mt-8 text-[16px] font-bold uppercase text-text">Histórico reciente</h2>
        {historico.length === 0 ? (
          <p className="text-[12.5px] text-text-muted">Todavía no hay citas anteriores.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {historico.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1.5 text-[12.5px]">
                <span className="text-text">
                  {fechaHoraLarga(c.horaInicio)} · {c.cliente} · {c.servicios || "Servicio"}
                </span>
                <span className="text-text-muted">{c.estado}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
