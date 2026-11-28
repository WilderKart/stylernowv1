/** Texto exacto que ve el cliente cuando el anticipo se transfirió directo al comercio (sin reembolso de StylerNow). */
/** Primera parte de la «Información importante» del pago directo. */
export const AVISO_PAGO_DIRECTO_COMERCIO =
  "El pago se realiza directamente a la cuenta del comercio. StylerNow solo facilita la reserva y no custodia ni valida transferencias.";

export const AVISO_PAGO_DIRECTO_SIN_REEMBOLSO =
  "Este anticipo fue transferido directamente a la cuenta del comercio. StylerNow no custodia ni reembolsa ese dinero; cualquier devolución o acuerdo debes gestionarlo directamente con la barbería.";

/** Puntos de la tarjeta «Sobre tu pago» (versión concisa; no omite ninguna idea del aviso largo de arriba). */
export const PUNTOS_SOBRE_TU_PAGO = [
  "El pago va directo a la cuenta del negocio.",
  "StylerNow solo facilita la reserva: no custodia ni valida transferencias.",
  "StylerNow no reembolsa ese dinero: cualquier devolución o acuerdo lo gestionas directamente con la barbería.",
] as const;

/** Texto exacto que el cliente acepta. Debe ser idéntico a public.texto_info_pago_directo() (migración 211); la base guarda ese texto como evidencia. */
export const TEXTO_INFO_PAGO_DIRECTO = PUNTOS_SOBRE_TU_PAGO.join(" ");
