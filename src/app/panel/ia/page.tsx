import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import {
  listarConsumoIa,
  listarFuncionesHabilitadasNegocio,
  listarMemoriaIa,
  listarPaquetesDisponiblesIa,
  listarPromptsIa,
  obtenerRoiIa,
  obtenerSaldoCreditosIa,
} from "./actions";
import { VistaAiWorkspace } from "./vista-ai-workspace";

export const metadata = { title: "IA" };

export default async function PanelIaPage() {
  // AI Memory, Prompt Library y compra de créditos son decisiones a nivel
  // Negocio (mismo alcance que Wallet/Mi Plan) — Guardian/Staff no gestionan
  // esto (ADR-013: "el propietario podrá... guardar/aprobar/olvidar").
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/ia");

  const negocioId = contexto.negocioId!;
  const [saldo, consumo, paquetes, memoria, prompts, roi, funciones] = await Promise.all([
    obtenerSaldoCreditosIa(negocioId),
    listarConsumoIa(negocioId),
    listarPaquetesDisponiblesIa(),
    listarMemoriaIa(negocioId),
    listarPromptsIa(negocioId),
    obtenerRoiIa(negocioId),
    listarFuncionesHabilitadasNegocio(negocioId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaAiWorkspace
        negocioId={negocioId}
        saldoInicial={saldo.ok ? saldo.data : 0}
        consumoInicial={consumo.ok ? consumo.data : []}
        paquetesIniciales={paquetes.ok ? paquetes.data : []}
        memoriaInicial={memoria.ok ? memoria.data : []}
        promptsIniciales={prompts.ok ? prompts.data : []}
        roiInicial={roi.ok ? roi.data : null}
        funcionesHabilitadas={funciones.ok ? funciones.data : []}
      />
    </div>
  );
}
