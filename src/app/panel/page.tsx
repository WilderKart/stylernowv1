import { PanelNav } from "@/components/panel/panel-nav";
import { Badge, Card } from "@/components/ui/card";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Panel" };

const ESTADO_TONO = {
  PENDIENTE_APROBACION: "neutral",
  ACTIVO: "success",
  SUSPENDIDO: "danger",
  RECHAZADO: "danger",
  CANCELADO: "danger",
} as const;

const ESTADO_TEXTO = {
  PENDIENTE_APROBACION: "En revisión por el equipo de StylerNow",
  ACTIVO: "Activo",
  SUSPENDIDO: "Suspendido",
  RECHAZADO: "Rechazado",
  CANCELADO: "Cancelado",
} as const;

/**
 * Raíz del Panel Negocio — ADR-006: compartida entre Barbería y Guardian,
 * el contenido se ramifica por `resolverContexto()`. Todavía NO es el
 * Dashboard del Módulo 2.2 (00_MASTER_TASKLIST.md) — es el destino mínimo
 * necesario para que el wizard de registro (2.1) tenga a dónde llevar al
 * negocio recién enviado a aprobación, sin inventar métricas falsas.
 */
export default async function PanelPage() {
  const contexto = await resolverContexto();
  if (contexto.rol === "NINGUNO") {
    if (!contexto.userId) redirect("/login?next=/panel");
    redirect("/panel/onboarding");
  }

  const supabase = await createClient();

  if (contexto.rol === "GUARDIAN") {
    const { data: sede } = await supabase
      .from("sede")
      .select("id, nombre, direccion, ciudad, cerrada_temporalmente, cerrada_permanente")
      .eq("id", contexto.sedeId!)
      .single();
    if (!sede) redirect("/panel/onboarding");

    return (
      <div className="flex min-h-dvh flex-col bg-bg">
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

          <p className="mt-8 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
            El Dashboard con tus citas y ocupación (Módulo 2.2) todavía no está
            construido. Como Guardian, cuando exista, va a mostrar solo los datos de
            esta sede — nunca los de todo el negocio.
          </p>
        </div>
      </div>
    );
  }

  // rol === "BARBERIA"
  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, nombre, slug, estado, onboarding_completo, logo_url")
    .eq("id", contexto.negocioId!)
    .single();

  if (!negocio || !negocio.onboarding_completo) redirect("/panel/onboarding");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-10">
        <h1 className="font-display mb-6 text-[24px] font-bold uppercase text-text">
          {negocio.nombre}
        </h1>

        <Card className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Estado</p>
            <p className="mt-1 text-[15px] font-semibold text-text">
              {ESTADO_TEXTO[negocio.estado]}
            </p>
          </div>
          <Badge tone={ESTADO_TONO[negocio.estado]}>{negocio.estado}</Badge>
        </Card>

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

        <p className="mt-4 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
          El Dashboard completo (ingresos, ocupación, próximas citas — Módulo 2.2) todavía no
          está construido. Esta pantalla es el punto de llegada mínimo del registro.
        </p>
      </div>
    </div>
  );
}
