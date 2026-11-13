/** Mensajes en espanol (tuteo) para los codigos que lanzan las RPC de WhatsApp (migracion 120). */
const MENSAJES: Record<string, string> = {
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
  NO_AUTORIZADO: "No tienes permiso para esta acción.",
  FUNCION_NO_INCLUIDA: "Tu plan no incluye campañas de WhatsApp.",
  CATEGORIA_INVALIDA: "Elige una categoría válida (aviso o marketing).",
  NOMBRE_PLANTILLA_INVALIDO: "El nombre debe tener de 3 a 60 caracteres: minúsculas, números o guion bajo.",
  IDIOMA_INVALIDO: "Elige un idioma válido.",
  CUERPO_INVALIDO: "El texto de la plantilla debe tener entre 1 y 1.024 caracteres.",
  VARIABLES_INVALIDAS: "Las variables de la plantilla no son válidas.",
  VARIABLE_DESCONOCIDA: "Usaste una variable que no existe.",
  VARIABLE_DUPLICADA: "No repitas la misma variable.",
  MARCADORES_NO_COINCIDEN: "Los marcadores {{1}}, {{2}}… del texto deben coincidir, en orden, con las variables elegidas.",
  PLANTILLA_DUPLICADA: "Ya tienes una plantilla con ese nombre e idioma.",
  PLANTILLAS_MAXIMAS: "Llegaste al máximo de 100 plantillas.",
  PLANTILLA_NO_ENCONTRADA: "No encontramos esa plantilla.",
  PLANTILLA_NO_EDITABLE: "Solo puedes editar o borrar plantillas en borrador o rechazadas.",
  PLANTILLA_EN_USO: "Esta plantilla ya se usa en una campaña o mensaje; no se puede borrar.",
  PLANTILLA_RECHAZADA: "Esa plantilla fue rechazada. Edítala antes de usarla.",
  PLANTILLA_NO_APROBADA: "La plantilla todavía no está aprobada por WhatsApp.",
  CAMPANA_SOLO_MARKETING: "Las campañas usan plantillas de marketing. Los avisos se envían solos desde las reservas.",
  VARIABLE_NO_DISPONIBLE_EN_CAMPANA: "En campañas solo puedes usar las variables nombre del cliente y nombre del negocio.",
  NOMBRE_CAMPANA_INVALIDO: "El nombre de la campaña debe tener entre 2 y 80 caracteres.",
  FECHA_INVALIDA: "Programa la campaña al menos 5 minutos en el futuro y máximo a 90 días.",
  CAMPANAS_MAXIMAS: "Tienes demasiadas campañas abiertas. Cancela o termina alguna.",
  CAMPANA_NO_ENCONTRADA: "No encontramos esa campaña.",
  TRANSICION_INVALIDA: "Esa acción no está disponible en el estado actual.",
  SIN_DESTINATARIOS: "Ningún cliente de este segmento aceptó recibir marketing por WhatsApp.",
  CUPO_MARKETING_INSUFICIENTE: "La campaña supera tu cupo de mensajes de marketing disponible.",
  SEGMENTO_INVALIDO: "Revisa los filtros del segmento.",
  PAQUETE_NO_DISPONIBLE: "Ese paquete de recarga ya no está disponible.",
  DEMASIADAS_SOLICITUDES_PENDIENTES: "Tienes varias solicitudes de recarga pendientes. Cancela alguna antes de crear otra.",
  COMPRA_NO_ENCONTRADA: "No encontramos esa solicitud de recarga.",
  MOTIVO_REQUERIDO: "Escribe un motivo (mínimo 5 caracteres) para la auditoría.",
  PORCENTAJE_INVALIDO: "Los porcentajes deben estar entre 0 y 100.",
  VENCIMIENTO_INVALIDO: "El vencimiento debe estar entre 1 y 36 meses.",
  UMBRALES_INVALIDOS: "Indica de 1 a 5 umbrales entre 1 y 100.",
  PROVEEDOR_INVALIDO: "Proveedor no válido.",
  ESTADO_SOLO_SISTEMA: "Ese estado solo lo fija el sistema al verificar la conexión con el proveedor.",
  CODIGO_INVALIDO: "El código debe tener de 3 a 40 caracteres: mayúsculas, números o guion bajo.",
  CODIGO_DUPLICADO: "Ya existe un paquete con ese código.",
  NOMBRE_INVALIDO: "El nombre debe tener entre 2 y 60 caracteres.",
  CANTIDAD_INVALIDA: "La cantidad de conversaciones no es válida.",
  PRECIO_INVALIDO: "El precio no es válido.",
  MONEDA_INVALIDA: "La moneda debe ser un código de 3 letras (por ejemplo COP).",
  PAQUETE_NO_ENCONTRADO: "No encontramos ese paquete.",
  VERSION_DESACTUALIZADA: "Ese paquete ya tiene una versión más nueva. Recarga la página.",
};

export function traducirErrorWhatsApp(mensaje: string): string {
  if (/could not find the function|does not exist/i.test(mensaje)) {
    return "El módulo de WhatsApp todavía no está activado en la base de datos.";
  }
  const clave = Object.keys(MENSAJES)
    .sort((a, b) => b.length - a.length)
    .find((k) => mensaje.includes(k));
  return clave ? MENSAJES[clave] : "No pudimos completar la acción. Intenta de nuevo.";
}
