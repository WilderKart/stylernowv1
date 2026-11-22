/** Tipos de documento y estados de la verificación del negocio (migración 150). Compartido por panel, CRM y API. */

export const TIPOS_DOCUMENTO = [
  { valor: "EXISTENCIA_COMERCIAL", etiqueta: "Certificado de existencia comercial", grupo: "Existencia del negocio" },
  { valor: "RUT", etiqueta: "RUT", grupo: "Existencia del negocio" },
  { valor: "MATRICULA_MERCANTIL", etiqueta: "Matrícula mercantil", grupo: "Existencia del negocio" },
  { valor: "ALTERNATIVO_INDEPENDIENTE", etiqueta: "Otro soporte de tu actividad (independientes)", grupo: "Existencia del negocio" },
  { valor: "FOTO_ESTABLECIMIENTO", etiqueta: "Fotografías reales del establecimiento", grupo: "Establecimiento y ubicación" },
  { valor: "EVIDENCIA_UBICACION", etiqueta: "Evidencia de ubicación", grupo: "Establecimiento y ubicación" },
  { valor: "IDENTIDAD_ADMINISTRADOR", etiqueta: "Documento de identidad de quien administra", grupo: "Administrador" },
  { valor: "AUTORIZACION_ADMINISTRADOR", etiqueta: "Autorización de quien administra el negocio", grupo: "Administrador" },
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]["valor"];

export const ETIQUETA_TIPO: Record<string, string> = Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t.valor, t.etiqueta]));

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
