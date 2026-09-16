import { BarraSuperior } from "@/components/layout/header";
import { Badge, Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata = { title: "Mis Gift Cards" };

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  ACTIVA: "success",
  BLOQUEADA: "neutral",
  CANJEADA: "danger",
  VENCIDA: "danger",
};
const ESTADO_ETIQUETA: Record<string, string> = {
  ACTIVA: "Lista para usar",
  BLOQUEADA: "Procesando pago",
  CANJEADA: "Ya canjeada",
  VENCIDA: "Vencida",
};

export default async function MisGiftCardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gift-cards/mis");

  // RLS `gift_card_select` ya devuelve tanto las que compré como las que
  // me regalaron (por email verificado contra mi propio JWT).
  const { data: giftCards } = await supabase
    .from("gift_card")
    .select("id, codigo, monto_original, saldo_actual, estado, fecha_expiracion, comprador_id, destinatario_nombre, mensaje, negocio:negocio_id (nombre)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Mis Gift Cards" volverA="/gift-cards" />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        {(giftCards ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Todavía no tenés ninguna Gift Card.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {(giftCards ?? []).map((g) => {
              const negocio = g.negocio as unknown as { nombre: string } | null;
              const esCompradaPorMi = g.comprador_id === user.id;
              return (
                <Card key={g.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">{negocio?.nombre}</p>
                      <p className="mt-0.5 font-mono text-[15px] font-bold tracking-wide text-text">{g.codigo}</p>
                      {!esCompradaPorMi ? <p className="text-[11px] text-text-faint">Regalo{g.mensaje ? `: "${g.mensaje}"` : ""}</p> : null}
                    </div>
                    <Badge tone={ESTADO_TONO[g.estado] ?? "neutral"}>{ESTADO_ETIQUETA[g.estado] ?? g.estado}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5">
                    <p className="text-[12px] text-text-muted">Saldo</p>
                    <p className="text-[15px] font-bold text-text">{formatCOP(Number(g.saldo_actual))}{Number(g.saldo_actual) !== Number(g.monto_original) ? <span className="ml-1 text-[11px] font-normal text-text-faint">de {formatCOP(Number(g.monto_original))}</span> : null}</p>
                  </div>
                  {g.fecha_expiracion ? (
                    <p className="mt-1 text-[10.5px] text-text-faint">Vence el {new Date(g.fecha_expiracion).toLocaleDateString("es-CO")}</p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
