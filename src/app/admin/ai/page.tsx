import {
  listarAccionesCostoIa,
  listarFuncionesPlanIa,
  listarModelosIa,
  listarPaquetesIa,
  obtenerResumenConsumoIa,
} from "./actions";
import { VistaAiCenter } from "./vista-ai-center";

export const metadata = { title: "AI Center" };

export default async function AdminAiPage() {
  const [acciones, modelos, paquetes, funciones, resumen] = await Promise.all([
    listarAccionesCostoIa(),
    listarModelosIa(),
    listarPaquetesIa(),
    listarFuncionesPlanIa(),
    obtenerResumenConsumoIa(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">AI Center</h1>
      <p className="mb-6 text-[12px] text-text-faint">
        AI Pricing Engine, Cost Optimizer, paquetes de créditos y funciones por Plan — ADR-013. &quot;StylerNow nunca
        subsidia IA&quot;: todo costo acá definido se cobra al Negocio en créditos.
      </p>
      <VistaAiCenter
        accionesIniciales={acciones.ok ? acciones.data : []}
        modelosIniciales={modelos.ok ? modelos.data : []}
        paquetesIniciales={paquetes.ok ? paquetes.data : []}
        funcionesIniciales={funciones.ok ? funciones.data : []}
        resumenInicial={resumen.ok ? resumen.data : null}
      />
    </main>
  );
}
