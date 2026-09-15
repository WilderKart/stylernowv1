import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listarConsumoPorServicio } from "../actions";
import { EditorConsumo } from "./editor-consumo";

export const metadata = { title: "Consumo por Servicio" };

export default async function ConsumoPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/inventario/consumo");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // "Configurar reglas" es exclusivo de Barbería (03-Business-Rules/01_Roles.md).
  if (contexto.rol !== "BARBERIA") redirect("/panel/inventario");

  const negocioId = contexto.negocioId!;
  const supabase = await createClient();
  const [{ data: servicios }, { data: productos }, resConsumo] = await Promise.all([
    supabase.from("servicio").select("id, nombre").eq("negocio_id", negocioId).eq("estado", "ACTIVO").order("nombre"),
    supabase.from("producto").select("id, nombre").eq("negocio_id", negocioId).eq("estado", "ACTIVO").order("nombre"),
    listarConsumoPorServicio(negocioId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Consumo por Servicio" volverA="/panel/inventario" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        <p className="mb-4 text-[12.5px] text-text-muted">
          Definí qué Productos consume automáticamente cada Servicio al completarse (ej. “Corte”
          gasta 5 ml de “Shampoo”) — el stock se descuenta solo al cerrar la venta en Caja.
        </p>
        <EditorConsumo
          servicios={servicios ?? []}
          productos={productos ?? []}
          consumoInicial={resConsumo.ok ? resConsumo.data : []}
        />
      </main>
    </div>
  );
}
