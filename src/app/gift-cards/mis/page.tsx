import { ErrorAviso, Pantalla, TicketCita, Top } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import { Check, Clock, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Mis Gift Cards" };

const ESTADO: Record<string, { tone: "ok" | "warn" | "err" | "info"; etiqueta: string; icono: typeof Check }> = {
  ACTIVA: { tone: "ok", etiqueta: "Lista para usar", icono: Check },
  BLOQUEADA: { tone: "warn", etiqueta: "Procesando pago", icono: Clock },
  CANJEADA: { tone: "info", etiqueta: "Ya canjeada", icono: Check },
  VENCIDA: { tone: "err", etiqueta: "Vencida", icono: X },
};

/** El "día" del ticket muestra el monto abreviado (50 + MIL), como en el prototipo. */
function montoTicket(monto: number) {
  return monto >= 1000 ? { dia: String(Math.round(monto / 1000)), mes: "Mil" } : { dia: String(monto), mes: "COP" };
}

export default async function MisGiftCardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gift-cards/mis");

  // RLS `gift_card_select` ya devuelve tanto las que compré como las que
  // me regalaron (por email verificado contra mi propio JWT).
  const { data: giftCards, error } = await supabase
    .from("gift_card")
    .select("id, codigo, monto_original, saldo_actual, estado, fecha_expiracion, comprador_id, destinatario_nombre, mensaje, negocio:negocio_id (nombre)")
    .order("created_at", { ascending: false });

  return (
    <Pantalla className="pb-10">
      <Top titulo="Mis gift cards" volverA="/gift-cards" />
      <div className="flex flex-col gap-4 p-4">
        {error ? <ErrorAviso>No pudimos cargar tus gift cards. Intenta de nuevo.</ErrorAviso> : null}
        {(giftCards ?? []).length === 0 && !error ? (
          <div className="sn-empty">
            <p className="section">Aún no tienes ninguna gift card.</p>
            <Button asChild>
              <Link href="/gift-cards/comprar">Comprar una</Link>
            </Button>
          </div>
        ) : (
          <ul className="p-stack">
            {(giftCards ?? []).map((g) => {
              const negocio = g.negocio as unknown as { nombre: string } | null;
              const esCompradaPorMi = g.comprador_id === user.id;
              const e = ESTADO[g.estado] ?? { tone: "info" as const, etiqueta: g.estado, icono: Clock };
              const Icono = e.icono;
              const t = montoTicket(Number(g.monto_original));
              return (
                <li key={g.id}>
                  <TicketCita
                    dia={t.dia}
                    mes={t.mes}
                    estado={
                      <Status tone={e.tone} icon={<Icono aria-hidden className="size-3.5" />}>
                        {e.etiqueta}
                      </Status>
                    }
                    titulo={`Gift card · ${negocio?.nombre ?? ""}`}
                    lineas={[
                      <span key="c" className="font-mono font-bold">
                        {g.codigo}
                      </span>,
                      !esCompradaPorMi ? `Regalo${g.mensaje ? `: "${g.mensaje}"` : ""}` : null,
                      g.fecha_expiracion ? `Vence el ${new Date(g.fecha_expiracion).toLocaleDateString("es-CO")}` : null,
                    ].filter(Boolean)}
                    pie={
                      <>
                        <span className="sn-label">
                          Saldo
                          {Number(g.saldo_actual) !== Number(g.monto_original) ? ` · de ${formatCOP(Number(g.monto_original))}` : ""}
                        </span>
                        <span className="sn-price">{formatCOP(Number(g.saldo_actual))}</span>
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Pantalla>
  );
}
