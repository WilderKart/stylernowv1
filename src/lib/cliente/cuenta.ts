import "server-only";
import { llamarRpc, type Resultado } from "./base";

/**
 * C15 Datos y cuenta.
 * Exportar: devuelve el JSON completo al instante (el diseño promete ZIP por correo: la UI puede ofrecer
 * la descarga del JSON y, si se quiere ZIP/CSV, empaquetarlo en servidor).
 * Eliminar: solicitud con 14 días de gracia (cancelable); luego el cron anonimiza (ver migraciones 099/100).
 */
export const exportarMisDatos = (): Promise<Resultado<Record<string, unknown>>> => llamarRpc<Record<string, unknown>>("exportar_mis_datos");

export interface ResumenEliminacion {
  puede_eliminar: boolean;
  /** ES_SUPERSU | NEGOCIO_ACTIVO | STAFF_ACTIVO cuando puede_eliminar = false. */
  motivo_bloqueo: string | null;
  /** «Se cancela tu cita del jueves…» */
  citas_futuras: { reserva_id: string; hora_inicio: string; negocio: string }[];
  /** «Tu saldo de $ X vuelve…» (se crea una solicitud de devolución). */
  saldo: number;
  dias_gracia: number;
  /** Solicitud ya en curso. */
  pendiente: { solicitud_id: string; programada_para: string } | null;
}
export const resumenEliminacion = (): Promise<Resultado<ResumenEliminacion>> => llamarRpc<ResumenEliminacion>("resumen_eliminacion_cuenta");

/** Paso 2 de 2: `confirmacion` debe ser «ELIMINAR» (sin distinguir mayúsculas). Idempotente. */
export const solicitarEliminacion = (confirmacion: string): Promise<Resultado<{ id: string; estado: string; programada_para: string }>> =>
  llamarRpc("solicitar_eliminacion_cuenta", { p_confirmacion: confirmacion });

/** Cancela la solicitud pendiente durante la gracia. true si había una. */
export const cancelarEliminacion = (): Promise<Resultado<boolean>> => llamarRpc<boolean>("cancelar_eliminacion_cuenta");
