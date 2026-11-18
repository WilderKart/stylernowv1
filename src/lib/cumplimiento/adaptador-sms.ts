/**
 * Adaptador de SMS del Centro de Cumplimiento. HOY NO HAY PROVEEDOR: el registro está vacío, así que el adaptador siempre
 * responde «no habilitado» y la base marca la alerta CANAL_NO_HABILITADO. Nunca se simula un envío.
 *
 * Para habilitar un proveedor más adelante (sin tocar la lógica de alertas):
 *   1. Implementar `ProveedorSms` y registrarlo en PROVEEDORES con su código (p. ej. "TWILIO").
 *   2. Guardar las credenciales como variable de entorno del servidor y poner su NOMBRE en `sms_credenciales_ref`
 *      (el secreto nunca se guarda en la base ni se muestra en el CRM).
 *   3. Desde el CRM: `sms_proveedor` = código y `sms_habilitado` = true (la base se niega si falta proveedor o referencia).
 * Un envío solo es «ENVIADO» si el proveedor devuelve un identificador; sin identificador se reintenta o falla.
 */
export type ResultadoSms = { ok: true; idExterno: string } | { ok: false; codigo: string; reintentable: boolean };

export interface ProveedorSms {
  enviar(args: { para: string; texto: string; idempotencia: string; credencial: string }): Promise<ResultadoSms>;
}

const PROVEEDORES: Record<string, ProveedorSms> = {};

export interface ConfigSms {
  habilitado: boolean;
  proveedor: string | null;
  credencialesRef: string | null;
}

export function adaptadorSms(cfg: ConfigSms, env: Record<string, string | undefined>) {
  const proveedor = cfg.proveedor ? PROVEEDORES[cfg.proveedor] : undefined;
  const credencial = cfg.credencialesRef ? env[cfg.credencialesRef]?.trim() : undefined;
  const habilitado = cfg.habilitado && !!proveedor && !!credencial;
  return {
    habilitado,
    async enviar(para: string, texto: string, idempotencia: string): Promise<ResultadoSms> {
      if (!habilitado || !proveedor || !credencial) return { ok: false, codigo: "CANAL_NO_HABILITADO", reintentable: false };
      return proveedor.enviar({ para, texto, idempotencia, credencial });
    },
  };
}
