import { Top, Pantalla } from "@/app/lealtad/ui-cliente";
import { BottomNav } from "@/components/layout/bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerT } from "@/lib/i18n/servidor";
import { ListaReservas, type ReservaItem } from "./lista-reservas";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("citas.meta"), robots: { index: false, follow: false } };
}

/** Momento del render en el servidor, para separar próximas de pasadas. */
function ahoraMs() {
  return Date.now();
}

export default async function MisReservasPage() {
  const t = await obtenerT();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mis-reservas");

  // RLS `reserva_select_cliente` ya devuelve solo las Reservas propias.
  const { data: reservas, error } = await supabase
    .from("reserva")
    .select(
      `id, estado, hora_inicio, monto_total, monto_sena,
       negocio:negocio_id (nombre),
       sede:sede_id (zona_horaria),
       staff:staff_id (nombre),
       reserva_servicio (servicio:servicio_id (nombre))`
    )
    .order("hora_inicio", { ascending: false })
    .limit(50);

  const items: ReservaItem[] = (reservas ?? []).map((r) => ({
    id: r.id,
    estado: r.estado,
    horaInicio: r.hora_inicio,
    zonaHoraria: (r.sede as unknown as { zona_horaria: string } | null)?.zona_horaria ?? "America/Bogota",
    negocio: (r.negocio as unknown as { nombre: string } | null)?.nombre ?? "—",
    profesional: (r.staff as unknown as { nombre: string } | null)?.nombre ?? null,
    servicios: (r.reserva_servicio ?? [])
      .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
      .filter(Boolean)
      .join(" + "),
    montoTotal: Number(r.monto_total),
  }));

  return (
    <Pantalla className="pb-24">
      <Top titulo={t("citas.top")} />
      <h1 className="poster-2 break-words px-4 pt-3 pb-4">
        {t("citas.t1")}
        <br />
        <span className="sn-hot">{t("citas.t2")}</span>
      </h1>

      {error ? (
        <p role="alert" className="sn-help sn-help--error mx-4 mb-4">
          {t("citas.error")}
        </p>
      ) : null}

      <ListaReservas reservas={items} ahora={ahoraMs()} />

      <BottomNav />
    </Pantalla>
  );
}
