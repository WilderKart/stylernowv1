import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Wizard } from "./wizard";

export const metadata = { title: "Registrá tu negocio" };

export default async function OnboardingNegocioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/panel/onboarding");

  const { data: negocio } = await supabase
    .from("negocio")
    .select(
      "id, nombre, categoria, ciudad, descripcion, logo_url, telefono_contacto, email_contacto, plan_codigo, onboarding_completo, estado"
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  // Un negocio ya enviado a aprobación no vuelve al wizard — el resumen vive
  // en /panel (Módulo 2.2, placeholder mientras tanto).
  if (negocio?.onboarding_completo) redirect("/panel");

  const [{ data: sede }, { data: servicios }, { data: suscripcion }, { data: invitaciones }] =
    negocio
      ? await Promise.all([
          supabase
            .from("sede")
            .select("id, nombre, direccion, ciudad, horario_base, latitud, longitud")
            .eq("negocio_id", negocio.id)
            .eq("cerrada_permanente", false)
            .order("created_at")
            .limit(1)
            .maybeSingle()
            .then((r) => ({ data: r.data })),
          supabase
            .from("servicio")
            .select("id, nombre, descripcion, duracion_minutos, precio_base")
            .eq("negocio_id", negocio.id)
            .eq("estado", "ACTIVO")
            .order("created_at"),
          supabase.from("suscripcion").select("plan_codigo").eq("negocio_id", negocio.id).maybeSingle(),
          supabase
            .from("invitacion_staff")
            .select("id, email, estado")
            .eq("negocio_id", negocio.id)
            .order("created_at"),
        ])
      : [{ data: null }, { data: [] }, { data: null }, { data: [] }];

  return (
    <Wizard
      perfilEmail={user.email ?? ""}
      negocioInicial={negocio ?? null}
      sedeInicial={sede ?? null}
      serviciosIniciales={servicios ?? []}
      planInicial={suscripcion?.plan_codigo ?? null}
      invitacionesIniciales={invitaciones ?? []}
    />
  );
}
