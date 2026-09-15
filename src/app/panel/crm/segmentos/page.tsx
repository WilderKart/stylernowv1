import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { listarEtiquetasNegocio } from "../actions";
import { ConstructorSegmentos } from "./constructor-segmentos";

export const metadata = { title: "Segmentos de Clientes" };

export default async function SegmentosPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/crm/segmentos");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const resEtiquetas = await listarEtiquetasNegocio(negocioId);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Segmentos de Clientes" volverA="/panel/crm" />
      <ConstructorSegmentos
        negocioId={negocioId}
        sedeIdFijo={contexto.rol === "GUARDIAN" ? contexto.sedeId : null}
        etiquetasDisponibles={resEtiquetas.ok ? resEtiquetas.data : []}
      />
    </div>
  );
}
