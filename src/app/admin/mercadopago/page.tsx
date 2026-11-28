import { requireSuperSU } from "@/lib/auth/require-supersu";
import { modoMercadoPago } from "@/lib/pagos/modo-mercadopago";
import { CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { EncabezadoAdmin } from "../_componentes/encabezado-admin";
import { Caja, TituloCaja } from "../_componentes/ui-admin";

export const dynamic = "force-dynamic";

/** Modo de Mercado Pago (prueba o real). Solo muestra prefijos y el tipo de cuenta; nunca el valor de una credencial. */
export default async function AdminMercadoPagoPage() {
  await requireSuperSU();
  const modo = await modoMercadoPago();
  const Icono = modo.nivel === "ok" ? CircleCheck : CircleX;

  return (
    <main className="w-full min-w-0 max-w-5xl flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Mercado Pago"
        titulo="Modo de"
        resaltado="pagos."
        descripcion="Aquí ves si la plataforma cobra en pruebas o en real. Se consulta a Mercado Pago de verdad cada vez que abres o recargas la página; las credenciales nunca se muestran."
        acciones={
          <a href="/admin/mercadopago" className="inline-flex min-h-11 items-center gap-2 border-2 border-border px-3.5 font-mono text-[11.5px] font-bold uppercase text-text hover:bg-text hover:text-bg">
            <RefreshCw className="size-4" aria-hidden /> Volver a medir
          </a>
        }
      />
      <Caja destacada>
        <TituloCaja>Estado actual</TituloCaja>
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <Icono className={`mt-0.5 size-6 shrink-0 ${modo.nivel === "ok" ? "text-success" : "text-danger"}`} aria-hidden />
          <p className="text-[14px] text-text">{modo.detalle}</p>
        </div>
      </Caja>
      <Caja className="mt-4">
        <TituloCaja>Cómo leerlo</TituloCaja>
        <ul className="list-disc space-y-1.5 px-9 pb-4 pt-2 text-[12.5px] text-text-muted">
          <li>Entorno SANDBOX con «cuenta de PRUEBA»: se pueden probar pagos con usuarios de prueba de Mercado Pago.</li>
          <li>Entorno SANDBOX con «cuenta REAL»: las credenciales son de producción y los pagos de prueba se rechazan; hay que poner las de prueba en Vercel.</li>
          <li>Para cobrar en real hay que definir MERCADOPAGO_ENTORNO=produccion en Vercel (solo vale en el despliegue de producción).</li>
          <li>La clave secreta del webhook (MERCADOPAGO_WEBHOOK_SECRET) debe ser la del mismo modo que las credenciales.</li>
        </ul>
      </Caja>
    </main>
  );
}
