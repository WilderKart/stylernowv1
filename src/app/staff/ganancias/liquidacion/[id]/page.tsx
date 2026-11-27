import { BotonImprimir } from "@/components/ganancias/boton-imprimir";
import { Comprobante } from "@/components/ganancias/comprobante";
import { llamar } from "@/lib/ganancias/rpc";
import { notFound } from "next/navigation";
import { z } from "zod";

export const metadata = { title: "Comprobante de liquidación" };

export default async function ComprobanteStaffPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  // La base solo entrega la liquidación si es del propio profesional (o si tiene permiso de gestión); si no, «no encontrada».
  const r = await llamar<React.ComponentProps<typeof Comprobante>["d"]>("liquidacion_comprobante", { p_liquidacion: id });
  if (!r.ok) notFound();
  return (
    <main className="flex-1 px-4 py-8">
      <div className="mx-auto mb-3 flex max-w-3xl justify-end"><BotonImprimir /></div>
      <Comprobante d={r.data} />
    </main>
  );
}
