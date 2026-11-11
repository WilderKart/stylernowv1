import { BarraSuperior } from "@/components/layout/header";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { listarEtiquetasNegocio } from "../actions";
import { ConstructorSegmentos } from "./constructor-segmentos";

export const metadata = { title: "Segmentos de Clientes" };

export default async function SegmentosPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/crm/segmentos");

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
