import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ConexionNoDisponible, cuentaDePago } from "./conexiones";
import { crearPreferencia, type PreferenciaCreada } from "./mercadopago";

/**
 * Único punto de creación de cobros en línea (Checkout Pro).
 *
 * Quien llama solo aporta textos de presentación y la URL de retorno. Monto, comisión
 * (`marketplace_fee`) y cuenta de cobro salen del `pago` que la base de datos ya fijó
 * (migraciones 008/119): un cobro del negocio se crea con el token DE SU CUENTA y nunca
 * con el de StylerNow; un ingreso de StylerNow, con el de la plataforma.
 */

export interface DatosCobro {
  pagoId: string;
  titulo: string;
  emailPagador?: string | null;
  urlRetorno: string;
  expiraEn?: string | null;
}

function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export class CobroNoDisponible extends Error {}

export async function crearPreferenciaDePago(d: DatosCobro): Promise<PreferenciaCreada> {
  const admin = createAdminClient();
  const { data } = await (admin as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: unknown }> } };
    };
  })
    .from("pago")
    .select("id, monto, estado, marketplace_fee")
    .eq("id", d.pagoId)
    .single();
  const pago = data as { id: string; monto: number; estado: string; marketplace_fee: number | null } | null;
  if (!pago) throw new CobroNoDisponible("PAGO_NO_ENCONTRADO");
  if (pago.estado !== "PENDIENTE") throw new CobroNoDisponible("PAGO_YA_PROCESADO");

  let cuenta;
  try {
    cuenta = await cuentaDePago(pago.id);
  } catch (e) {
    if (e instanceof ConexionNoDisponible) {
      throw new CobroNoDisponible("El negocio no tiene su cuenta de Mercado Pago conectada. No se puede cobrar en línea.");
    }
    throw e;
  }

  const sitio = urlSitio();
  // Sin URL pública (desarrollo local) la pasarela no puede notificar: se reconcilia por consulta.
  const webhook = sitio.startsWith("https://")
    ? `${sitio}/api/webhooks/pasarela/mercadopago${cuenta.conexionId ? `?c=${cuenta.conexionId}` : ""}`
    : null;

  const preferencia = await crearPreferencia({
    pagoId: pago.id,
    titulo: d.titulo,
    monto: Number(pago.monto),
    emailPagador: d.emailPagador,
    urlRetorno: d.urlRetorno,
    urlWebhook: webhook,
    expiraEn: d.expiraEn ?? null,
    token: cuenta.token,
    marketplaceFee: Number(pago.marketplace_fee ?? 0),
  });

  // `pago` no tiene política de escritura para roles de producto: lo guarda el servidor.
  await admin.from("pago").update({ id_preferencia_pasarela: preferencia.id }).eq("id", pago.id);
  return preferencia;
}
