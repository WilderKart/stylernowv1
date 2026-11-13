import { EmptyState } from "@/components/brutal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FlujoReserva } from "./flujo-reserva";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  // El flujo depende de la sesión y de disponibilidad en vivo: no debe indexarse.
  return { title: t("res.meta"), robots: { index: false, follow: false } };
}

export default async function ReservarPage(props: PageProps<"/negocio/[slug]/reservar">) {
  const { slug } = await props.params;
  const t = await obtenerT();
  const { staff: staffParam } = await props.searchParams;
  const staffPreseleccionado = typeof staffParam === "string" ? staffParam : null;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 02-UX/05_Booking.md: exclusivo de Cliente autenticado, no existe modo invitado.
  if (!user) redirect(
      `/login?next=${encodeURIComponent(`/negocio/${slug}/reservar${staffPreseleccionado ? `?staff=${staffPreseleccionado}` : ""}`)}`
    );

  const { data: negocio } = await supabase
    .from("negocio")
    .select(
      "id, nombre, slug, pago_completo_en_app, sena_pct, sena_monto_fijo, sena_minimo, sena_maximo, ventana_reembolso_total_horas, ventana_reembolso_parcial_horas, reembolso_parcial_pct, anticipo_modo"
    )
    .eq("slug", slug)
    .eq("estado", "ACTIVO")
    .maybeSingle();

  if (!negocio) notFound();

  // Migración 119: sin cuenta de cobro propia conectada, el anticipo en línea es 0 (lo decide la base).
  const { data: cobraEnLinea } = await (supabase as unknown as {
    rpc: (n: string, a: object) => Promise<{ data: unknown }>;
  }).rpc("negocio_cobra_en_linea", { p_negocio_id: negocio.id });

  const [{ data: sedes }, { data: servicios }, { data: staff }, { data: combosData }] = await Promise.all([
    supabase
      .from("sede")
      .select("id, nombre, direccion, zona_horaria, ciudad, latitud, longitud")
      .eq("negocio_id", negocio.id)
      .eq("cerrada_permanente", false)
      .eq("cerrada_temporalmente", false)
      .order("created_at"),
    supabase
      .from("servicio")
      .select("id, nombre, descripcion, duracion_minutos, precio_base, anticipo_pct, anticipo_monto_fijo")
      .eq("negocio_id", negocio.id)
      .eq("estado", "ACTIVO")
      .order("precio_base"),
    supabase.rpc("negocio_staff_publico", { p_negocio_id: negocio.id }),
    supabase
      .from("servicio_combo")
      .select("id, nombre, servicio_combo_item (servicio_id)")
      .eq("negocio_id", negocio.id)
      .eq("estado", "ACTIVO")
      .order("nombre"),
  ]);

  // Un combo con algún Servicio ya desactivado no se ofrece — evita que el
  // Cliente arme una Reserva con un `servicio_id` que ya no es reservable.
  const idsServiciosActivos = new Set((servicios ?? []).map((s) => s.id));
  const combos = (combosData ?? [])
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      servicio_ids: (c.servicio_combo_item ?? []).map((i) => i.servicio_id),
    }))
    .filter((c) => c.servicio_ids.length >= 2 && c.servicio_ids.every((id) => idsServiciosActivos.has(id)));

  if (!sedes?.length || !servicios?.length) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-bg">
        <div className="p-top">
          <Link href={`/negocio/${slug}`} aria-label={t("comun.volver")} className="sn-iconbtn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="sn-num">{t("res.reserva_negocio", { nombre: negocio.nombre })}</span>
        </div>
        <EmptyState
          big={t("res.sin_turnos")}
          title={t("res.no_acepta")}
          hint={t("res.no_acepta_hint")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-bg">
      <FlujoReserva
        negocio={{ ...negocio, cobra_en_linea: cobraEnLinea !== false }}
        sedes={sedes}
        servicios={servicios}
        staff={(staff ?? []).map((p) => ({ ...p, nivel: p.nivel }))}
        combos={combos}
      />
    </div>
  );
}
