import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { notFound, redirect } from "next/navigation";
import { listarFotos, listarHistorialCliente, listarNotas, obtenerBeneficiosLealtadCliente, obtenerResumenCliente } from "../actions";
import { DetalleCliente } from "./detalle-cliente";

export const metadata = { title: "Cliente" };

export default async function ClienteDetallePage(props: PageProps<"/panel/crm/[clienteId]">) {
  const { clienteId } = await props.params;
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect(`/login?next=/panel/crm/${clienteId}`);
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const resResumen = await obtenerResumenCliente(negocioId, clienteId);
  if (!resResumen.ok) notFound();

  const [resHistorial, resNotas, resFotos, resBeneficios] = await Promise.all([
    listarHistorialCliente(negocioId, clienteId),
    listarNotas(negocioId, clienteId),
    listarFotos(negocioId, clienteId),
    obtenerBeneficiosLealtadCliente(negocioId, clienteId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-16">
      <BarraSuperior titulo={resResumen.data.nombre} volverA="/panel/crm" />
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
