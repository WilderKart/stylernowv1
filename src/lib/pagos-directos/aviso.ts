/** Texto exacto que ve el cliente cuando el anticipo se transfirió directo al comercio (sin reembolso de StylerNow). */
/** Primera parte de la «Información importante» del pago directo. */
export const AVISO_PAGO_DIRECTO_COMERCIO =
  "El pago se realiza directamente a la cuenta del comercio. StylerNow solo facilita la reserva y no custodia ni valida transferencias.";

export const AVISO_PAGO_DIRECTO_SIN_REEMBOLSO =
  "Este anticipo fue transferido directamente a la cuenta del comercio. StylerNow no custodia ni reembolsa ese dinero; cualquier devolución o acuerdo debes gestionarlo directamente con la barbería.";

/** Texto completo que el cliente acepta. Debe ser idéntico a public.texto_info_pago_directo() (migración 210); la base guarda ese texto como evidencia. */
export const TEXTO_INFO_PAGO_DIRECTO = `${AVISO_PAGO_DIRECTO_COMERCIO} ${AVISO_PAGO_DIRECTO_SIN_REEMBOLSO}`;
