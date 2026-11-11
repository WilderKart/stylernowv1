import "server-only";
import { llamarRpc, type Resultado } from "./base";

/**
 * C14 Centro de privacidad. Consentimientos APPEND-ONLY por propósito: sin evento = NO otorgado;
 * retirar = nuevo evento. «Funcionamiento de la app» es necesario y NO se guarda como consentimiento.
 * Mapeo con el diseño: analitica = «Analítica de uso», personalizacion = «Recomendaciones personalizadas»,
 * ofertas_cercanas = «Ofertas de negocios cercanos», beneficios_marcas = «Beneficios de marcas aliadas».
 * marketing_email = novedades de StylerNow por correo (casilla del registro C17; no aparece en las 4 filas de C14).
 */
export type PropositoConsentimiento = "analitica" | "personalizacion" | "ofertas_cercanas" | "beneficios_marcas" | "marketing_email";

export interface EstadoConsentimiento {
  proposito: PropositoConsentimiento;
  otorgado: boolean;
  /** Fecha del último evento; null si nunca hubo decisión. */
  desde: string | null;
}
export const obtenerPrivacidad = (): Promise<Resultado<EstadoConsentimiento[]>> => llamarRpc<EstadoConsentimiento[]>("privacidad_estado");

/** «GUARDAR PREFERENCIAS». Solo registra los que cambian. Devuelve el estado resultante. */
export const guardarPrivacidad = (preferencias: Partial<Record<PropositoConsentimiento, boolean>>): Promise<Resultado<EstadoConsentimiento[]>> =>
  llamarRpc<EstadoConsentimiento[]>("privacidad_guardar", { p_preferencias: preferencias });

export interface EventoHistorial {
  fecha: string;
  tipo: "CONSENTIMIENTO" | "LEGAL";
  /** Propósito, o «TERMINOS v3» / «POLITICA_DATOS v3» para tipo LEGAL. */
  proposito: string;
  /** ACEPTADO | RECHAZADO | RETIRADO */
  valor: "ACEPTADO" | "RECHAZADO" | "RETIRADO";
}
/** «HISTORIAL DE CAMBIOS» (más reciente primero). */
export const historialPrivacidad = (limite = 50): Promise<Resultado<EventoHistorial[]>> => llamarRpc<EventoHistorial[]>("privacidad_historial", { p_limite: limite });
