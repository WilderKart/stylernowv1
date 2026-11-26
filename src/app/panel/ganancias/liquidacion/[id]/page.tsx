import { BotonImprimir } from "@/components/ganancias/boton-imprimir";
import { Comprobante } from "@/components/ganancias/comprobante";
import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { llamar } from "@/lib/ganancias/rpc";
import { notFound } from "next/navigation";
import { z } from "zod";

export const metadata = { title: "Comprobante de liquidación" };

export default async function ComprobantePanelPage(props: { params: Promise<{ id: string }> }) {
  const contexto = await verificarAccesoPanel(["BARBERIA", "ADMIN", "GUARDIAN"], "/panel/ganancias");
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  // La base decide si este usuario puede ver ESTA liquidación; si no, responde «no encontrada» sin revelar si existe.
  const r = await llamar<React.ComponentProps<typeof Comprobante>["d"]>("liquidacion_comprobante", { p_liquidacion: id });
  if (!r.ok) notFound();
  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <div className="print:hidden"><PanelNav rol={contexto.rol} /></div>
      <main className="flex-1 px-4 py-8">
        <div className="mx-auto mb-3 flex max-w-3xl justify-end"><BotonImprimir /></div>
        <Comprobante d={r.data} />
      </main>
    </div>
  );
}
