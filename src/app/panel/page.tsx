import { Badge, Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
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
 * Raíz del Panel Negocio. Todavía NO es el Dashboard del Módulo 2.2
 * (00_MASTER_TASKLIST.md) — es el destino mínimo necesario para que el wizard
 * de registro (Módulo 2.1) tenga a dónde llevar al negocio recién enviado a
 * aprobación, sin inventar una pantalla de métricas con datos falsos.
 */
export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/panel");

  const { data: negocio } = await supabase
    .from("negocio")
    .select("id, nombre, slug, estado, onboarding_completo, logo_url")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!negocio) redirect("/panel/onboarding");
  if (!negocio.onboarding_completo) redirect("/panel/onboarding");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-8 sm:px-10">
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
        <Card className="border-accent/30 bg-accent-soft">
          <p className="text-[13px] font-bold text-text">Tu negocio está en revisión</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
            El equipo de StylerNow revisa los datos que cargaste y lo activa — normalmente
            en menos de 24 horas hábiles. Te avisamos por correo apenas quede activo.
          </p>
        </Card>
      ) : null}

      <p className="mt-8 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
        El Dashboard completo (ingresos, ocupación, próximas citas — Módulo 2.2) todavía no
        está construido. Esta pantalla es el punto de llegada mínimo del registro.
      </p>
    </div>
  );
}
