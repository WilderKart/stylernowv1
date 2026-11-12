import { ErrorAviso, Pantalla, TicketCita, Top } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/utils";
import { Check, Clock, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerIdioma, obtenerT } from "@/lib/i18n/servidor";
import type { Clave } from "@/lib/i18n/diccionario";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("gc.mis_meta_pag") };
}

const ESTADO: Record<string, { tone: "ok" | "warn" | "err" | "info"; etiqueta: Clave; icono: typeof Check }> = {
  ACTIVA: { tone: "ok", etiqueta: "gc.est_activa", icono: Check },
  BLOQUEADA: { tone: "warn", etiqueta: "gc.est_bloqueada", icono: Clock },
  CANJEADA: { tone: "info", etiqueta: "gc.est_canjeada", icono: Check },
  VENCIDA: { tone: "err", etiqueta: "gc.est_vencida", icono: X },
};

/** El "día" del ticket muestra el monto abreviado (50 + MIL), como en el prototipo. */
function montoTicket(monto: number, mil: string) {
  return monto >= 1000 ? { dia: String(Math.round(monto / 1000)), mes: mil } : { dia: String(monto), mes: "COP" };
}

export default async function MisGiftCardsPage() {
  const t = await obtenerT();
  const idioma = await obtenerIdioma();
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
      <Top titulo={t("gc.mis")} volverA="/gift-cards" />
      <div className="flex flex-col gap-4 p-4">
        {error ? <ErrorAviso>{t("gc.err_cargar")}</ErrorAviso> : null}
        {(giftCards ?? []).length === 0 && !error ? (
          <div className="sn-empty">
            <p className="section">{t("gc.ninguna")}</p>
            <Button asChild>
              <Link href="/gift-cards/comprar">{t("gc.comprar_una")}</Link>
            </Button>
          </div>
        ) : (
          <ul className="p-stack">
            {(giftCards ?? []).map((g) => {
              const negocio = g.negocio as unknown as { nombre: string } | null;
              const esCompradaPorMi = g.comprador_id === user.id;
              const e = ESTADO[g.estado] ?? { tone: "info" as const, etiqueta: null, icono: Clock };
              const Icono = e.icono;
              const mt = montoTicket(Number(g.monto_original), t("gc.mil"));
              return (
                <li key={g.id}>
                  <TicketCita
                    dia={mt.dia}
                    mes={mt.mes}
                    estado={
                      <Status tone={e.tone} icon={<Icono aria-hidden className="size-3.5" />}>
                        {e.etiqueta ? t(e.etiqueta) : g.estado}
                      </Status>
                    }
                    titulo={t("gc.titulo_negocio", { negocio: negocio?.nombre ?? "" })}
                    lineas={[
                      <span key="c" className="font-mono font-bold">
                        {g.codigo}
                      </span>,
                      !esCompradaPorMi ? (g.mensaje ? t("gc.regalo_msg", { mensaje: g.mensaje }) : t("gc.regalo")) : null,
                      g.fecha_expiracion ? t("gc.vence", { fecha: new Date(g.fecha_expiracion).toLocaleDateString(idioma === "en" ? "en-US" : "es-CO") }) : null,
                    ].filter(Boolean)}
                    pie={
                      <>
                        <span className="sn-label">
                          {Number(g.saldo_actual) !== Number(g.monto_original) ? t("gc.saldo_de", { monto: formatCOP(Number(g.monto_original)) }) : t("gc.saldo")}
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
