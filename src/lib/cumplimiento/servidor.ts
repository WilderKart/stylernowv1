import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Las RPC y tablas del Centro de Cumplimiento (migraciones 151-155) aún no están en los tipos generados. */
export type RespuestaRpc<T = unknown> = { data: T | null; error: { message: string } | null };
type Resultado = Promise<{ data: unknown; error: { message: string } | null }>;
export type ClienteSinTipos = {
  rpc: (n: string, a?: object) => Resultado;
  from: (t: string) => { select: (c: string) => Resultado };
  storage: ReturnType<typeof createAdminClient>["storage"];
};

export function adminSinTipos(): ClienteSinTipos {
  return createAdminClient() as unknown as ClienteSinTipos;
}

export async function rpcServicio<T>(nombre: string, args?: object): Promise<RespuestaRpc<T>> {
  const { data, error } = await adminSinTipos().rpc(nombre, args);
  return { data: (data as T) ?? null, error };
}

export function urlSitio(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type ConfigCumplimiento = {
  alertas_email_destinatarios: string[];
  correo_remitente: string;
  correo_atencion: string;
  correo_operativo: string;
  sms_numero: string;
  sms_habilitado: boolean;
  sms_proveedor: string | null;
  sms_credenciales_ref: string | null;
};

export async function leerConfig(): Promise<ConfigCumplimiento> {
  const { data } = await adminSinTipos().from("cumplimiento_config").select("clave, valor");
  const filas = (data as { clave: string; valor: unknown }[] | null) ?? [];
  const m = new Map(filas.map((r) => [r.clave, r.valor]));
  return {
    alertas_email_destinatarios: Array.isArray(m.get("alertas_email_destinatarios")) ? (m.get("alertas_email_destinatarios") as string[]) : [],
    correo_remitente: (m.get("correo_remitente") as string) ?? "StylerNow <notificaciones@mail.stylernow.com>",
    correo_atencion: (m.get("correo_atencion") as string) ?? "",
    correo_operativo: (m.get("correo_operativo") as string) ?? "",
    sms_numero: (m.get("sms_numero") as string) ?? "",
    sms_habilitado: m.get("sms_habilitado") === true,
    sms_proveedor: (m.get("sms_proveedor") as string | null) ?? null,
    sms_credenciales_ref: (m.get("sms_credenciales_ref") as string | null) ?? null,
  };
}
