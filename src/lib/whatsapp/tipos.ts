/**
 * Tipos del modulo de WhatsApp (migracion 120). Los valores de los enums son los mismos que en SQL.
 * No hay proveedor conectado: ningun tipo aqui representa un envio exitoso que no haya confirmado el proveedor.
 */

export const ESTADOS_CONEXION = [
  "NO_CONFIGURADO",
  "PENDIENTE_CREDENCIALES",
  "SANDBOX",
  "PRODUCCION",
  "SUSPENDIDO",
  "REVOCADO",
  "ERROR",
] as const;
export type EstadoConexion = (typeof ESTADOS_CONEXION)[number];

/** Estados que SuperSU puede fijar a mano. SANDBOX / PRODUCCION / ERROR solo los fija el sistema con evidencia del proveedor. */
export const ESTADOS_CONEXION_ADMIN = ["NO_CONFIGURADO", "PENDIENTE_CREDENCIALES", "SUSPENDIDO", "REVOCADO"] as const;
export type EstadoConexionAdmin = (typeof ESTADOS_CONEXION_ADMIN)[number];

export const CATEGORIAS = ["UTILIDAD", "MARKETING"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ESTADOS_PLANTILLA = ["BORRADOR", "PENDIENTE_APROBACION", "APROBADA", "RECHAZADA"] as const;
export type EstadoPlantilla = (typeof ESTADOS_PLANTILLA)[number];

export const ESTADOS_CAMPANA = ["BORRADOR", "PROGRAMADA", "BLOQUEADA_SIN_CONEXION", "EN_ENVIO", "COMPLETADA", "CANCELADA"] as const;
export type EstadoCampana = (typeof ESTADOS_CAMPANA)[number];

export const ESTADOS_MENSAJE = ["PREPARADO", "BLOQUEADO_SIN_CONEXION", "ENVIADO", "ENTREGADO", "LEIDO", "FALLIDO"] as const;
export type EstadoMensaje = (typeof ESTADOS_MENSAJE)[number];

export const ESTADOS_COMPRA = ["PENDIENTE_PAGO", "ACREDITADA", "CANCELADA"] as const;
export type EstadoCompra = (typeof ESTADOS_COMPRA)[number];

export const PROVEEDORES = ["META_CLOUD_API", "TWILIO", "DIALOG_360", "OTRO"] as const;
export type Proveedor = (typeof PROVEEDORES)[number];

/** Catalogo de variables de plantilla (mismo orden y nombres que _whatsapp_validar_plantilla). */
export const VARIABLES_PLANTILLA = ["nombre_cliente", "nombre_negocio", "fecha_cita", "hora_cita", "servicio", "sede"] as const;
export type VariablePlantilla = (typeof VARIABLES_PLANTILLA)[number];
/** Las campanas solo pueden resolver estas variables por destinatario. */
export const VARIABLES_CAMPANA: readonly VariablePlantilla[] = ["nombre_cliente", "nombre_negocio"];

export interface Segmento {
  dias_sin_visita_min?: number | null;
  visitas_min?: number | null;
  etiqueta?: string | null;
}

export interface LoteSaldo {
  lote_id: string;
  cantidad?: number;
  cuota?: number;
  disponible: number;
  cupo_marketing: number;
  marketing_consumido: number;
  vence: string;
  periodo?: string;
}

export interface SaldoWhatsApp {
  disponible_total: number;
  marketing_disponible: number;
  recarga_disponible: number;
  plan: LoteSaldo | null;
  recargas: LoteSaldo[];
}

export interface ReglasWhatsApp {
  pct_marketing_plan: number;
  pct_marketing_recarga: number;
  meses_vencimiento_recarga: number;
  umbrales_alerta: number[];
}

export interface PlantillaWhatsApp {
  id: string;
  global: boolean;
  nombre: string;
  idioma: "es" | "en";
  categoria: Categoria;
  cuerpo: string;
  variables: VariablePlantilla[];
  estado: EstadoPlantilla;
  motivo_rechazo: string | null;
}

export interface CampanaWhatsApp {
  id: string;
  nombre: string;
  plantilla_id: string;
  categoria: Categoria;
  segmento: Segmento;
  programada_at: string | null;
  estado: EstadoCampana;
  destinatarios_estimados: number;
  motivo_estado: string | null;
}

export interface PaqueteRecarga {
  id: string;
  codigo: string;
  nombre: string;
  conversaciones: number;
  precio: number;
  moneda: string;
}

export interface CompraRecarga {
  id: string;
  conversaciones: number;
  precio: number;
  moneda: string;
  estado: EstadoCompra;
  fecha: string;
}

export interface ResumenPanelWhatsApp {
  conexion: { estado: EstadoConexion; envio_habilitado: boolean };
  reglas: ReglasWhatsApp;
  funcion_marketing: boolean;
  periodo: string;
  saldo: SaldoWhatsApp;
  consumo_mes: { utilidad: number; marketing: number };
  alertas: { umbral: number; pct: number; fecha: string }[];
  paquetes: PaqueteRecarga[];
  compras: CompraRecarga[];
  plantillas: PlantillaWhatsApp[];
  campanas: CampanaWhatsApp[];
}

export interface PaqueteAdmin extends PaqueteRecarga {
  version: number;
  activo: boolean;
  created_at: string;
}

export interface ResumenAdminWhatsApp {
  config: ReglasWhatsApp & {
    proveedor: Proveedor | null;
    estado_conexion: EstadoConexion;
    estado_conexion_detalle: string | null;
    estado_conexion_at: string | null;
    updated_at: string;
  };
  paquetes: PaqueteAdmin[];
  compras_pendientes: number;
  compras_recientes: (CompraRecarga & { negocio: string })[];
  plantillas_globales: { id: string; nombre: string; categoria: Categoria; estado: EstadoPlantilla }[];
}

export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };
