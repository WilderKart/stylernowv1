import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
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
    <main className="w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="IA Center" titulo="Motor de" resaltado="IA." />
      <p className="-mt-3 mb-6 max-w-3xl text-[13px] text-text-muted">
        AI Pricing Engine, Cost Optimizer, paquetes de créditos y funciones por Plan — ADR-013. &quot;StylerNow nunca
        subsidia IA&quot;: todo costo aquí definido se cobra al Negocio en créditos.
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
