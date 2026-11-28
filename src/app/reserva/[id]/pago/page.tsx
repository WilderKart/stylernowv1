import { resumenPoliticaCompacta } from "@/lib/pagos/sena";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { PantallaPago } from "./pantalla-pago";
import { RecuperarReserva, type SituacionRecuperacion } from "./recuperar-reserva";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("pago.meta"), robots: { index: false, follow: false } };
}

interface MediosDirectos {
  activo: boolean; llave_breb?: string | null; nequi?: string | null; daviplata?: string | null; link_pago?: string | null;
  qr_path?: string | null; instrucciones?: string | null; referencia?: string; saldo_pendiente?: number;
}

export default async function PagoPage(props: PageProps<"/reserva/[id]/pago">) {
  const { id } = await props.params;
  const t = await obtenerT();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/reserva/${id}/pago`);

  // RLS `reserva_select_cliente` ya limita la fila al dueño de la Reserva.
  const { data: reserva } = await supabase
    .from("reserva")
    .select(
      `id, negocio_id, estado, cancelado_motivo, hora_inicio, monto_total, monto_sena, expira_at,
       negocio:negocio_id (nombre, slug, ventana_reembolso_total_horas, ventana_reembolso_parcial_horas, reembolso_parcial_pct, anticipo_modo),
       sede:sede_id (zona_horaria),
       staff:staff_id (nombre),
       reserva_servicio (servicio:servicio_id (nombre))`
    )
    .eq("id", id)
    .maybeSingle();

  if (!reserva) notFound();

  // Bloqueo vencido (aún figura pendiente) o reserva cancelada SOLO por expirar el bloqueo: no es un callejón. El servidor comprueba la
  // disponibilidad real del turno (migración 205) y la pantalla ofrece continuar, otros horarios o retomar un pago ya reportado.
  const venció = reserva.estado === "PENDIENTE_PAGO" && reserva.expira_at !== null && new Date(reserva.expira_at) < new Date();
  const canceladaPorExpirar = reserva.estado === "CANCELADA" && reserva.cancelado_motivo === "PAGO_EXPIRADO";
  if (venció || canceladaPorExpirar) {
    const { data: diag } = await (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown }> }).rpc("reserva_estado_recuperacion", { p_reserva_id: id });
    const d = diag as { situacion?: string; motivo?: string | null } | null;
    if (d?.situacion === "YA_CONFIRMADA") redirect(`/reserva/${id}`);
    if (d?.situacion === "VIGENTE") redirect(`/reserva/${id}/pago`);        // otra pestaña ya lo recuperó: se vuelve a leer
    const n = reserva.negocio as unknown as { nombre: string; slug: string } | null;
    const sedeRec = reserva.sede as unknown as { zona_horaria: string } | null;
    const staffRec = reserva.staff as unknown as { nombre: string } | null;
    return (
      <RecuperarReserva
        situacion={(d?.situacion as SituacionRecuperacion | undefined) ?? "NO_RECUPERABLE"}
        motivo={d?.motivo ?? null}
        resumen={{
          reservaId: reserva.id,
          negocio: n?.nombre ?? "StylerNow",
          slug: n?.slug ?? "",
          servicios: (reserva.reserva_servicio ?? []).map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre ?? t("rv.servicio")).join(" + "),
          profesional: staffRec?.nombre ?? t("pago.profesional_asignado"),
          horaInicio: reserva.hora_inicio,
          zonaHoraria: sedeRec?.zona_horaria ?? "America/Bogota",
          montoTotal: Number(reserva.monto_total),
        }}
      />
    );
  }

  // Una Reserva ya confirmada o cancelada (por otro motivo) no vuelve a la pantalla de cobro.
  if (reserva.estado !== "PENDIENTE_PAGO") redirect(`/reserva/${id}`);

  const [{ data: mediosJson }, { data: cobraEnLinea }] = await Promise.all([
    supabase.rpc("medios_pago_directo_para_reserva", { p_reserva_id: id }),
    supabase.rpc("negocio_cobra_en_linea", { p_negocio_id: reserva.negocio_id }),
  ]);
  // La RPC devuelve jsonb (`Json` en los tipos generados): se acota a la forma documentada en la migración 194.
  const medios = mediosJson as unknown as MediosDirectos | null;
  let qrUrl: string | null = null;
  if (medios?.activo && medios.qr_path) {
    const { data: firmada } = await supabase.storage.from("pagos-directos").createSignedUrl(medios.qr_path, 1800);
    qrUrl = firmada?.signedUrl ?? null;
    if (!qrUrl) console.error("[pago] no se pudo firmar el QR del negocio", firmada === null ? "sin respuesta" : "sin url");
  }

  const negocio = reserva.negocio as unknown as {
    nombre: string;
    slug: string;
    ventana_reembolso_total_horas: number;
    ventana_reembolso_parcial_horas: number;
    reembolso_parcial_pct: number;
    anticipo_modo?: string;
  } | null;
  const sede = reserva.sede as unknown as { zona_horaria: string } | null;
  const staff = reserva.staff as unknown as { nombre: string } | null;
  const servicios = (reserva.reserva_servicio ?? []).map(
    (rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre ?? t("rv.servicio")
  );

  return (
    <PantallaPago
      volverA={negocio ? `/negocio/${negocio.slug}/reservar` : "/"}
      resumen={{
        reservaId: reserva.id,
        negocio: negocio?.nombre ?? "StylerNow",
        servicios: servicios.join(" + "),
        profesional: staff?.nombre ?? t("pago.profesional_asignado"),
        horaInicio: reserva.hora_inicio,
        zonaHoraria: sede?.zona_horaria ?? "America/Bogota",
        montoTotal: Number(reserva.monto_total),
        montoSena: Number(reserva.monto_sena),
        expiraAt: reserva.expira_at,
        // Solo para mostrar: lo que queda como evidencia lo reconstruye la base de datos
        // (`aceptar_politica_reserva`) con los números del negocio, no este texto.
        politica: negocio ? resumenPoliticaCompacta(negocio) : [],
        // Solo para mostrar el botón; la base lo vuelve a verificar al confirmar.
        anticipoOpcional: negocio?.anticipo_modo === "OPCIONAL",
        cobraEnLinea: cobraEnLinea !== false,
        negocioId: reserva.negocio_id,
        saldoPendiente: Number(medios?.saldo_pendiente ?? 0),
        directo: medios?.activo
          ? {
              llaveBreb: medios.llave_breb ?? null,
              nequi: medios.nequi ?? null,
              daviplata: medios.daviplata ?? null,
              linkPago: medios.link_pago ?? null,
              instrucciones: medios.instrucciones ?? null,
              referencia: medios.referencia ?? "",
              qrUrl,
            }
          : null,
      }}
    />
  );
}
