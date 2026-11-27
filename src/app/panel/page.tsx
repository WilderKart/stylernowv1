import { DashboardResumen } from "@/components/panel/dashboard-resumen";
import { EnlaceReserva } from "@/components/panel/enlace-reserva";
import { AsistenteBienvenida } from "@/components/panel/asistente-bienvenida";
import { ResumenBarberia } from "@/components/panel/resumen-barberia";
import { ResumenSuave } from "@/components/panel/resumen-suave";
import { verticalDeCategorias } from "@/lib/tema/vertical";
import { PanelNav } from "@/components/panel/panel-nav";
import { TarjetaPerfilProfesional } from "@/components/panel/tarjeta-perfil-profesional";
import { TarjetaVisibilidadPublica } from "@/components/panel/tarjeta-visibilidad-publica";
import { cargarDatosResumenSuave } from "./resumen-datos";
import { obtenerEstadoPublicacion } from "./staff/publicacion-actions";
import { Badge, Card } from "@/components/ui/card";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { obtenerCupoPlan } from "@/lib/planes/cupo";
import { createClient } from "@/lib/supabase/server";
import { obtenerEstadoOperativo } from "@/lib/suscripcion/estado-operativo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { contarPagosPorRevisar } from "./pagos/actions";
import { obtenerLineaTiempoDia, obtenerMetricasLealtadNegocio, obtenerProximasCitas, obtenerRankingSemana, obtenerResumenDia } from "./dashboard-actions";
import { ActualizarEnVivo } from "@/components/panel/actualizar-en-vivo";

export const metadata = { title: "Panel" };

async function cargarDashboard(negocioId: string, sedeId: string | null) {
  const [resResumen, resRanking, resTimeline, resProximas] = await Promise.all([
    obtenerResumenDia(negocioId, sedeId),
    obtenerRankingSemana(negocioId, sedeId),
    obtenerLineaTiempoDia(negocioId, sedeId),
    obtenerProximasCitas(negocioId, sedeId),
  ]);
  const erroresParciales = [resResumen, resRanking, resTimeline]
    .filter((r): r is { ok: false; error: string } => !r.ok)
    .map((r) => r.error);
  return {
    resumen: resResumen.ok ? resResumen.data : null,
    ranking: resRanking.ok ? resRanking.data : [],
    timeline: resTimeline.ok ? resTimeline.data : [],
    proximas: resProximas.ok ? resProximas.data : [],
    erroresParciales:
      erroresParciales.length > 0 ? ["No pudimos cargar todo el resumen del día — prueba recargar."] : [],
  };
}

/**
 * Raíz del Panel Negocio — ADR-006: compartida entre Barbería y Guardian,
 * el contenido se ramifica por `resolverContexto()`. Incluye el Dashboard
 * del Módulo 2.2 (`<DashboardResumen>`, mismo componente para ambos roles
 * — el alcance de Guardian ya viene recortado a su sede desde las RPCs de
 * la migración 016, nunca se calcula en el componente). Antes de que el
 * negocio quede `ACTIVO` no hay datos reales que mostrar, así que no se
 * consulta nada — nunca métricas inventadas en 0.
 */
export default async function PanelPage() {
  const contexto = await resolverContexto();
  if (contexto.rol === "NINGUNO") {
    if (!contexto.userId) redirect("/login?next=/panel");
    redirect("/panel/onboarding");
  }

  const supabase = await createClient();

  // Staff plano (o Guardian recién promovido sin sede asignada todavía): su
  // superficie real es la App Staff (Fase 4, `/staff`) — nunca el wizard de
  // alta de Negocio. `/staff` resuelve su propio contexto de forma
  // independiente (`obtenerContextoStaff()`) y ya maneja suspendido/
  // invitado/sin-vínculo con su propia pantalla, así que no se duplica esa
  // lógica aquí.
  if (contexto.rol === "STAFF") {
    redirect("/staff");
  }

  // Administrador delegado (BUSINESS_ADMIN / ADMIN_BARBER): hoy su superficie es el equipo (migración 161, denegado por defecto).
  if (contexto.rol === "ADMIN") {
    redirect("/panel/staff");
  }

  // FASE 2B: con la suscripción restringida el resumen operativo no aplica; el panel abre en el cumplimiento de citas pendientes.
  if ((contexto.rol === "BARBERIA" || contexto.rol === "GUARDIAN") && contexto.negocioId) {
    const estadoOperativo = await obtenerEstadoOperativo(contexto.negocioId);
    if (!estadoOperativo.operativo) redirect("/panel/cumplimiento");
  }

  if (contexto.rol === "GUARDIAN") {
    const { data: sede } = await supabase
      .from("sede")
      .select("id, nombre, direccion, ciudad, cerrada_temporalmente, cerrada_permanente")
      .eq("id", contexto.sedeId!)
      .single();
    if (!sede) redirect("/panel/onboarding");

    const dashboard = await cargarDashboard(contexto.negocioId!, sede.id);

    return (
      <div className="flex min-h-dvh flex-col bg-app">
        <PanelNav rol={contexto.rol} />
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-10">
          <h1 className="font-display mb-1 text-[24px] font-bold uppercase text-text">
            {sede.nombre}
          </h1>
          <p className="mb-6 text-[12.5px] text-text-faint">
            {sede.direccion} · {sede.ciudad}
          </p>

          <Card className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
                Estado de tu sede
              </p>
              <p className="mt-1 text-[15px] font-semibold text-text">
                {sede.cerrada_permanente
                  ? "Eliminada"
                  : sede.cerrada_temporalmente
                    ? "Cerrada temporalmente"
                    : "Operativa"}
              </p>
            </div>
            <Badge tone={sede.cerrada_permanente || sede.cerrada_temporalmente ? "danger" : "success"}>
              {sede.cerrada_permanente || sede.cerrada_temporalmente ? "CERRADA" : "OPERATIVA"}
            </Badge>
          </Card>

          <Link
            href={`/panel/sedes/${sede.id}`}
            className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:border-accent/40"
          >
            <div>
              <p className="text-[13.5px] font-bold text-text">Editar mi sede</p>
              <p className="text-[12px] text-text-faint">Horario, excepciones, Staff de la sede</p>
            </div>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-text-faint"
              aria-hidden="true"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>

          {/* Módulo 2.2 — mismo componente que ve Barbería, con el alcance ya
              recortado a ESTA sede server-side (dashboard_resumen_dia con
              p_sede_id) — nunca datos de todo el negocio para Guardian. */}
          <DashboardResumen
            resumen={dashboard.resumen}
            ranking={dashboard.ranking}
            timeline={dashboard.timeline}
            erroresParciales={dashboard.erroresParciales}
          />
        </div>
      </div>
    );
  }

  // rol === "BARBERIA"
  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, nombre, slug, estado, onboarding_completo, logo_url, descripcion, foto_principal_url, categoria")
    .eq("id", contexto.negocioId!)
    .single();

  if (!negocio || !negocio.onboarding_completo) redirect("/panel/onboarding");

  // Tareas del asistente de bienvenida (se calculan aqui, en el servidor; el navegador solo las muestra).
  const [{ count: nServicios }, cupo, { data: verif }] = await Promise.all([
    supabase.from("servicio").select("id", { count: "exact", head: true }).eq("negocio_id", negocio.id).eq("estado", "ACTIVO"),
    obtenerCupoPlan(negocio.id),
    (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: { estado: string } | null }> }).rpc("mi_verificacion_negocio", { p_negocio_id: negocio.id }),
  ]);
  const datosAsistente = {
    servicios: nServicios ?? 0,
    // El propio perfil profesional del propietario ocupa cupo, pero no es «invitar al equipo».
    equipo: Math.max((cupo?.staffUsado ?? 0) - (contexto.prestaServicios ? 1 : 0), 0),
    equipoTope: cupo?.staffTope ?? null,
    planNombre: cupo?.planNombre ?? "actual",
    perfilCompleto: Boolean(negocio.descripcion && negocio.foto_principal_url),
    verificacion: verif?.estado ?? "NO_INICIADA",
  };

  const estadoPublicacion = contexto.prestaServicios ? await obtenerEstadoPublicacion(negocio.id) : null;

  const dashboardBarberia =
    negocio.estado === "ACTIVO" ? await cargarDashboard(negocio.id, null) : null;
  const metricasLealtadRes = negocio.estado === "ACTIVO" ? await obtenerMetricasLealtadNegocio(negocio.id) : null;
  const metricasLealtad = metricasLealtadRes?.ok ? metricasLealtadRes.data : null;
  const pagosPorRevisar = negocio.estado === "ACTIVO" ? await contarPagosPorRevisar(negocio.id) : 0;

  const verticalSuave = verticalDeCategorias(negocio.categoria);
  const datosSuave = verticalSuave !== null ? await cargarDatosResumenSuave(negocio.id, negocio.estado === "ACTIVO") : null;

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} prestaServicios={contexto.prestaServicios} />
      {/* Apenas se agenda o se paga una reserva, el resumen se actualiza solo. */}
      {negocio.estado === "ACTIVO" ? <ActualizarEnVivo negocioId={negocio.id} /> : null}
      <div
        className={
          verticalSuave !== null
            ? "mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8"
            : "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-6 sm:px-10 sm:py-8"
        }
      >
        {verticalSuave !== null && datosSuave !== null ? (
          <ResumenSuave
            nombre={negocio.nombre}
            vertical={verticalSuave}
            datos={datosSuave}
            pagosPorRevisar={pagosPorRevisar}
            tareas={<AsistenteBienvenida datos={datosAsistente} suave />}
            estadoNegocio={negocio.estado}
            resumen={dashboardBarberia?.resumen ?? null}
            citas={dashboardBarberia?.timeline ?? []}
            lealtad={metricasLealtad}
          />
        ) : (
          <ResumenBarberia
            nombre={negocio.nombre}
            estadoNegocio={negocio.estado}
            resumen={dashboardBarberia?.resumen ?? null}
            citas={dashboardBarberia?.timeline ?? []}
            proximas={dashboardBarberia?.proximas ?? []}
            lealtad={metricasLealtad}
          />
        )}

        {pagosPorRevisar > 0 ? (
          <Link
            href="/panel/pagos"
            className="flex items-center justify-between gap-3 border-2 border-accent bg-accent-soft p-4 text-[14px] font-bold text-text"
          >
            <span>
              Pagos por revisar: {pagosPorRevisar} {pagosPorRevisar === 1 ? "transferencia espera" : "transferencias esperan"} tu verificación
            </span>
            <span aria-hidden>→</span>
          </Link>
        ) : null}

        {verticalSuave === null ? <AsistenteBienvenida datos={datosAsistente} /> : null}

        <TarjetaPerfilProfesional
          negocioId={negocio.id}
          prestaServicios={contexto.prestaServicios}
          disponibles={cupo?.capacidad?.disponibles ?? null}
          limite={cupo?.staffTope ?? null}
          ocupados={cupo?.staffUsado ?? 0}
          planNombre={cupo?.planNombre ?? "actual"}
          puedeActivar={cupo?.perfilPropietario.puedeActivar ?? false}
          puedeDesactivar={cupo?.perfilPropietario.puedeDesactivar ?? false}
        />

        {estadoPublicacion?.ok ? <TarjetaVisibilidadPublica estado={estadoPublicacion.data} /> : null}

        {negocio.estado === "PENDIENTE_APROBACION" ? (
          <Card className="mb-6 border-accent/30 bg-accent-soft">
            <p className="text-[13px] font-bold text-text">Tu negocio está en revisión</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
              El equipo de StylerNow revisa los datos que cargaste y lo activa — normalmente
              en menos de 24 horas hábiles. Te avisamos por correo apenas quede activo.
            </p>
          </Card>
        ) : null}

        <Link
          href="/panel/sedes"
          className="mb-3 flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:border-accent/40"
        >
          <div>
            <p className="text-[13.5px] font-bold text-text">Gestionar sedes</p>
            <p className="text-[12px] text-text-faint">
              Horarios, ubicación, cierres, staff por sede
            </p>
          </div>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-text-faint"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>

        {negocio.estado === "ACTIVO" ? <EnlaceReserva slug={negocio.slug} /> : null}

        {dashboardBarberia ? (
          <DashboardResumen
            resumen={dashboardBarberia.resumen}
            ranking={dashboardBarberia.ranking}
            timeline={dashboardBarberia.timeline}
            erroresParciales={dashboardBarberia.erroresParciales}
            soloRanking
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
            El resumen del día se activa apenas tu negocio quede{" "}
            <strong className="text-text">Aprobado</strong> — necesita Sedes y Staff aprobados
            para tener datos reales que mostrar.
          </p>
        )}
      </div>
    </div>
  );
}
