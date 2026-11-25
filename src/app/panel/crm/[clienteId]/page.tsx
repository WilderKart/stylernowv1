import { BarraSuperior } from "@/components/layout/header";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { notFound } from "next/navigation";
import { listarFotos, listarHistorialCliente, listarNotas, obtenerBeneficiosLealtadCliente, obtenerResumenCliente } from "../actions";
import { obtenerSaldoCliente } from "@/app/panel/pagos/actions";
import { DetalleCliente } from "./detalle-cliente";
import { SaldoPendienteCliente } from "./saldo-pendiente";

export const metadata = { title: "Cliente" };

export default async function ClienteDetallePage(props: PageProps<"/panel/crm/[clienteId]">) {
  const { clienteId } = await props.params;
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], `/panel/crm/${clienteId}`);

  const negocioId = contexto.negocioId!;
  const resResumen = await obtenerResumenCliente(negocioId, clienteId);
  if (!resResumen.ok) notFound();

  const [saldoPendiente, resHistorial, resNotas, resFotos, resBeneficios] = await Promise.all([
    obtenerSaldoCliente(clienteId),
    listarHistorialCliente(negocioId, clienteId),
    listarNotas(negocioId, clienteId),
    listarFotos(negocioId, clienteId),
    obtenerBeneficiosLealtadCliente(negocioId, clienteId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-app pb-16">
      <BarraSuperior titulo={resResumen.data.nombre} volverA="/panel/crm" />
      <SaldoPendienteCliente clienteId={clienteId} saldo={saldoPendiente} puedeAjustar={contexto.rol === "BARBERIA"} />
      <DetalleCliente
        negocioId={negocioId}
        resumen={resResumen.data}
        historialInicial={resHistorial.ok ? resHistorial.data : []}
        notasIniciales={resNotas.ok ? resNotas.data : []}
        fotosIniciales={resFotos.ok ? resFotos.data : []}
        beneficiosLealtad={resBeneficios.ok ? resBeneficios.data : null}
      />
    </div>
  );
}
