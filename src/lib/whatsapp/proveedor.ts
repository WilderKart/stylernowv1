import type { EstadoConexion } from "./tipos";

/**
 * Contrato del adaptador de proveedor de WhatsApp (Meta Cloud API, Twilio, etc.).
 *
 * Reglas para cualquier adaptador real:
 *  - `enviarPlantilla` solo devuelve `ok: true` cuando el proveedor respondio con su id de mensaje.
 *    Ese id se registra con la RPC de service_role `whatsapp_sistema_registrar_envio`; antes hay que
 *    reservar saldo con `whatsapp_sistema_reservar_envio`.
 *  - Entregado / leido / fallido llegan por webhook del proveedor y se aplican con
 *    `whatsapp_sistema_actualizar_estado` guardando el payload como evidencia.
 *  - Las credenciales viven en variables de entorno del servidor, nunca en la base ni en el navegador.
 */
export interface MensajePlantilla {
  telefono: string;
  plantillaNombre: string;
  idioma: "es" | "en";
  /** Valores por posicion: {"1": "Ana", "2": "Barberia X"}. */
  variables: Record<string, string>;
}

export type ResultadoEnvio =
  | { ok: true; proveedorMensajeId: string; evidencia: Record<string, unknown> }
  | { ok: false; motivo: "SIN_CONEXION" | "RECHAZADO_POR_PROVEEDOR" | "ERROR_RED"; detalle?: string };

export type ResultadoSolicitudPlantilla =
  | { ok: true; proveedorPlantillaId: string }
  | { ok: false; motivo: "SIN_CONEXION" | "RECHAZADO_POR_PROVEEDOR" | "ERROR_RED"; detalle?: string };

export interface ProveedorWhatsApp {
  readonly nombre: string;
  /** Estado real comprobado contra el proveedor (no el que dice la base). */
  verificarConexion(): Promise<{ estado: EstadoConexion; detalle: string }>;
  enviarPlantilla(mensaje: MensajePlantilla): Promise<ResultadoEnvio>;
  solicitarAprobacionPlantilla(p: { nombre: string; idioma: "es" | "en"; categoria: "UTILIDAD" | "MARKETING"; cuerpo: string }): Promise<ResultadoSolicitudPlantilla>;
}

/** Adaptador vigente: no hay proveedor conectado. Nunca simula exito. */
export const proveedorNoConectado: ProveedorWhatsApp = {
  nombre: "NO_CONECTADO",
  async verificarConexion() {
    return { estado: "NO_CONFIGURADO", detalle: "No hay un proveedor de WhatsApp conectado." };
  },
  async enviarPlantilla() {
    return { ok: false, motivo: "SIN_CONEXION" };
  },
  async solicitarAprobacionPlantilla() {
    return { ok: false, motivo: "SIN_CONEXION" };
  },
};

/** Punto unico para obtener el adaptador. Cuando exista un proveedor real, se elige aqui segun el entorno del servidor. */
export function obtenerProveedor(): ProveedorWhatsApp {
  return proveedorNoConectado;
}
