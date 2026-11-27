import { Badge, Card } from "@/components/ui/card";
import Link from "next/link";
import type { MediosPago } from "../pagos/actions";

/**
 * Segunda forma de cobrar, junto a Mercado Pago: pago directo por Nequi, Daviplata, llave Bre-B o QR. El cliente transfiere a la
 * cuenta DEL NEGOCIO y sube su comprobante; la cita se agenda al instante y el negocio revisa después que el dinero llegó
 * (StylerNow nunca da el pago por hecho ni toca ese dinero). Aquí solo se resume el estado y se lleva a configurarlo.
 */
export function MediosDirectos({ medios, mercadoPagoConectado, porRevisar }: { medios: MediosPago | null; mercadoPagoConectado: boolean; porRevisar: number }) {
  const configurados = medios
    ? [medios.nequi && "Nequi", medios.daviplata && "Daviplata", medios.llaveBreb && "Llave Bre-B", medios.linkPago && "Link de pago", medios.qrPath && "QR"].filter(Boolean)
    : [];
  const directoActivo = Boolean(medios?.activo);
  const puedeCobrar = mercadoPagoConectado || directoActivo;

  return (
    <section aria-label="Pago directo" className="mt-6 flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="section">Pago directo (Nequi, Daviplata, llaves)</h2>
          <Badge tone={directoActivo ? "success" : "neutral"}>{directoActivo ? "Activo" : "Sin activar"}</Badge>
        </div>
        <p className="text-[13px] text-text-muted">
          Si no conectas Mercado Pago, tus clientes pueden pagar el anticipo (o el servicio completo) transfiriendo a tu Nequi, Daviplata o llave Bre-B, y subir el
          comprobante desde su celular. Su cita queda agendada al momento; tú confirmas después que el dinero llegó a tu cuenta.
        </p>
        {configurados.length > 0 ? (
          <p className="text-[12.5px]">
            Configurado: <b>{configurados.join(" · ")}</b>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/panel/pagos" className="border-2 border-ink bg-accent px-4 py-2.5 text-[12.5px] font-bold uppercase text-ink">
            {directoActivo ? "Editar mis cuentas" : "Configurar Nequi / llaves"}
          </Link>
          {porRevisar > 0 ? (
            <Link href="/panel/pagos" className="text-[12.5px] font-bold underline">
              {porRevisar} comprobante{porRevisar === 1 ? "" : "s"} por revisar
            </Link>
          ) : null}
        </div>
      </Card>

      {!puedeCobrar ? (
        <p role="status" className="border-2 border-danger p-3 text-[13px] font-semibold text-danger">
          Hoy no tienes cómo cobrar anticipos: tus reservas se confirman sin cobro y el cliente paga todo en el local. Conecta Mercado Pago o activa el pago directo.
        </p>
      ) : null}
    </section>
  );
}
