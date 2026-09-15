import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listarSolicitudesPendientes, listarStock } from "./actions";
import { VistaInventario } from "./vista-inventario";

export const metadata = { title: "Inventario" };

export default async function InventarioPage(props: PageProps<"/panel/inventario">) {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/inventario");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const supabase = await createClient();
  const searchParams = await props.searchParams;
  const sedeParam = typeof searchParams.sede === "string" ? searchParams.sede : null;

  const { data: sedesNegocio } = await supabase
    .from("sede")
    .select("id, nombre")
    .eq("negocio_id", negocioId)
    .eq("cerrada_permanente", false)
    .order("es_principal", { ascending: false })
    .order("nombre");

  if (!sedesNegocio || sedesNegocio.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg">
        <PanelNav rol={contexto.rol} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 text-center sm:px-10">
          <p className="text-[12.5px] text-text-faint">Necesitás al menos una sede operativa para usar el Inventario.</p>
        </main>
      </div>
    );
  }

  const sedeActivaId =
    contexto.rol === "GUARDIAN"
      ? contexto.sedeId!
      : sedeParam && sedesNegocio.some((s) => s.id === sedeParam)
        ? sedeParam
        : sedesNegocio[0].id;

  const [resStock, resSolicitudes] = await Promise.all([
    listarStock(negocioId, sedeActivaId),
    listarSolicitudesPendientes(negocioId, sedeActivaId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaInventario
        negocioId={negocioId}
        sedes={contexto.rol === "BARBERIA" ? sedesNegocio : null}
        sedeActivaId={sedeActivaId}
        stockInicial={resStock.ok ? resStock.data : []}
        solicitudesIniciales={resSolicitudes.ok ? resSolicitudes.data : []}
        errorInicial={resStock.ok ? null : resStock.error}
        puedeConfigurarReglas={contexto.rol === "BARBERIA"}
      />
    </div>
  );
}
