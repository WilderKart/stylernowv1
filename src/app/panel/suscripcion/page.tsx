import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { obtenerCatalogoPlanes, obtenerMiSuscripcion } from "./actions";
import { VistaSuscripcion } from "./vista-suscripcion";

export const metadata = { title: "Mi Plan" };

export default async function SuscripcionPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/suscripcion");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // 04_Subscriptions_Lifecycle.md, Permisos: solo la Barbería (dueña de la
  // suscripción) gestiona upgrade/downgrade/cancelación — Guardian/Staff no.
  if (contexto.rol !== "BARBERIA") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const [suscripcionRes, planesRes] = await Promise.all([
    obtenerMiSuscripcion(negocioId),
    obtenerCatalogoPlanes(),
  ]);

  if (!suscripcionRes.ok) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg">
        <PanelNav rol={contexto.rol} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
          <p className="text-[12.5px] font-semibold text-danger">{suscripcionRes.error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaSuscripcion
        negocioId={negocioId}
        suscripcionInicial={suscripcionRes.data}
        planes={planesRes.ok ? planesRes.data : []}
      />
    </div>
  );
}
