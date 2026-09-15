import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { RespuestaInvitacion } from "./respuesta-invitacion";

export const metadata = { title: "Invitación a StylerNow" };

export default async function InvitacionPage(props: PageProps<"/invitacion/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invitacion/${id}`);

  const { data: invitacion } = await supabase
    .from("invitacion_staff")
    .select("id, negocio_id, email, estado, expira_at, sede_id")
    .eq("id", id)
    .maybeSingle();
  if (!invitacion) notFound();

  const [{ data: negocio }, { data: sede }] = await Promise.all([
    supabase.from("negocio").select("nombre, logo_url").eq("id", invitacion.negocio_id).maybeSingle(),
    invitacion.sede_id
      ? supabase.from("sede").select("nombre").eq("id", invitacion.sede_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const expirada = invitacion.estado === "PENDIENTE" && new Date(invitacion.expira_at) < new Date();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface p-6 text-center">
        <p className="text-[12px] font-bold uppercase tracking-wide text-accent">
          Invitación a StylerNow
        </p>
        <h1 className="font-display mt-1 text-[22px] font-bold text-text">
          {negocio?.nombre ?? "Un negocio"}
        </h1>
        <p className="mt-2 text-[13px] text-text-muted">
          Te invitó a unirte a su equipo{sede?.nombre ? ` en ${sede.nombre}` : ""}.
        </p>

        <RespuestaInvitacion
          invitacionId={invitacion.id}
          estado={invitacion.estado}
          expirada={expirada}
        />
      </div>
    </div>
  );
}
