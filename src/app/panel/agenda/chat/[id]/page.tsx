import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { ChatCita } from "../../chat-cita";

export const metadata = { title: "Chat con el cliente", robots: { index: false, follow: false } };

/**
 * Chat de una cita a pantalla completa. Es el destino del aviso push «{cliente} te escribió»: ruta sin parámetros para que el
 * enlace del aviso sea seguro, y sirve igual desde la campanita del panel.
 */
export default async function ChatCitaPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], `/panel/agenda/chat/${id}`);

  const supabase = await createClient();
  // RLS: solo devuelve citas del negocio del usuario; aun así se comprueba el negocio explícitamente.
  const { data: reserva } = await supabase
    .from("reserva")
    .select("id, estado, negocio_id, hora_inicio, cliente:cliente_id (nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!reserva || reserva.negocio_id !== contexto.negocioId) notFound();

  const cliente = (reserva.cliente as unknown as { nombre: string } | null)?.nombre ?? "Cliente";
  const cuando = new Date(reserva.hora_inicio).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5">
        <Link href="/panel/agenda" className="text-[12.5px] font-semibold text-text-muted">
          ← Volver a la agenda
        </Link>
        <h1 className="mt-3 font-display text-[20px] font-bold uppercase text-text">{cliente}</h1>
        <p className="mt-0.5 text-[12.5px] capitalize text-text-faint">Cita: {cuando}</p>
        <ChatCita reservaId={reserva.id} clienteNombre={cliente} cerrado={["CANCELADA", "PENDIENTE_PAGO", "NO_SHOW"].includes(reserva.estado)} />
      </main>
    </div>
  );
}
