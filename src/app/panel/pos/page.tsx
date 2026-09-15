import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { listarProductos, listarReservasParaCobrar } from "./actions";
import { ListaPOS } from "./lista-pos";

export const metadata = { title: "Caja" };

export default async function POSPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/pos");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const sedeId = contexto.rol === "GUARDIAN" ? contexto.sedeId : null;

  const [resReservas, resProductos] = await Promise.all([
    listarReservasParaCobrar(negocioId, sedeId),
    listarProductos(negocioId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
        <ListaPOS
          negocioId={negocioId}
          reservasIniciales={resReservas.ok ? resReservas.data : []}
          productos={resProductos.ok ? resProductos.data.filter((p) => p.estado === "ACTIVO") : []}
          errorInicial={resReservas.ok ? null : resReservas.error}
        />
      </main>
    </div>
  );
}
