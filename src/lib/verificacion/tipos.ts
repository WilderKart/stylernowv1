/** Tipos de documento y estados de la verificación del negocio (migración 157). Compartido por panel, CRM y API. */

/**
 * Documentos que el negocio puede subir, según su figura (persona natural o empresa). Los valores son los permitidos
 * por la base de datos (migración 157); solo cambian las etiquetas y el orden para que sean los documentos comunes.
 */
export const TIPOS_DOCUMENTO = [
  { valor: "RUT", etiqueta: "RUT o NIT (empresa o persona natural)", grupo: "Documento del negocio" },
  { valor: "IDENTIDAD_ADMINISTRADOR", etiqueta: "Cédula de ciudadanía de quien administra", grupo: "Documento del negocio" },
  { valor: "MATRICULA_MERCANTIL", etiqueta: "Matrícula mercantil (si la tienes)", grupo: "Documento del negocio" },
  { valor: "ALTERNATIVO_INDEPENDIENTE", etiqueta: "Otro soporte de tu actividad (independientes)", grupo: "Documento del negocio" },
  { valor: "FOTO_ESTABLECIMIENTO", etiqueta: "Fotografías reales del establecimiento", grupo: "Establecimiento y ubicación" },
  { valor: "EVIDENCIA_UBICACION", etiqueta: "Evidencia de ubicación", grupo: "Establecimiento y ubicación" },
  { valor: "AUTORIZACION_ADMINISTRADOR", etiqueta: "Autorización de quien administra el negocio", grupo: "Administrador" },
] as const;

/** Tipos que ya no se ofrecen pero pueden existir en documentos subidos antes: se siguen mostrando con su nombre. */
const ETIQUETAS_ANTERIORES: Record<string, string> = { EXISTENCIA_COMERCIAL: "Certificado de existencia comercial" };

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]["valor"];

export const ETIQUETA_TIPO: Record<string, string> = {
  ...ETIQUETAS_ANTERIORES,
  ...Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t.valor, t.etiqueta])),
};

export type EstadoVerificacion =
  | "NO_INICIADA"
  | "PENDIENTE_DOCUMENTACION"
  | "EN_REVISION"
  | "VERIFICADA"
  | "REQUIERE_CORRECCION"
  | "RECHAZADA"
  | "REVOCADA";

export const ETIQUETA_ESTADO: Record<EstadoVerificacion, string> = {
  NO_INICIADA: "No iniciada",
  PENDIENTE_DOCUMENTACION: "Pendiente de documentación",
  EN_REVISION: "En revisión",
  VERIFICADA: "Verificada",
  REQUIERE_CORRECCION: "Requiere corrección",
  RECHAZADA: "Rechazada",
  REVOCADA: "Verificación revocada",
};

export const TAMANO_MAXIMO_DOCUMENTO = 8 * 1024 * 1024;
