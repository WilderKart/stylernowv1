import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listarTickets, mensajesTicket } from "@/lib/cliente/soporte";
import { notFound } from "next/navigation";
import { VistaTicket } from "./vista-ticket";

export const metadata = {
  title: "Ticket de soporte",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  // Guard de sesión en el servidor (defensa en profundidad además del proxy).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ayuda");

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [lista, mensajes] = await Promise.all([listarTickets(100), mensajesTicket(id)]);
  const ticket = lista.ok ? lista.data.find((t) => t.ticket_id === id) : undefined;
  if (lista.ok && !ticket) notFound();

  return (
    <VistaTicket
      id={id}
      ticket={ticket ?? null}
      mensajes={mensajes.ok ? mensajes.data : []}
      error={!lista.ok ? lista.error : !mensajes.ok ? mensajes.error : null}
    />
  );
}
