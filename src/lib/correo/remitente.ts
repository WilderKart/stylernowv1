/**
 * Remitente ÚNICO de todos los correos de StylerNow (Resend).
 *
 * Debe ser un dominio VERIFICADO en Resend. `stylernow.com` está verificado; `mail.stylernow.com`
 * nunca se terminó de configurar (estado «Not Started») y por eso Resend rechazaba con 403 todos
 * los correos: invitaciones de Staff, notificaciones y avisos de suscripción (2026-11-16).
 * Se puede sobrescribir con NOTIFICACIONES_EMAIL_REMITENTE sin tocar código.
 */
export const REMITENTE_CORREO =
  process.env.NOTIFICACIONES_EMAIL_REMITENTE?.trim() || "StylerNow <notificaciones@stylernow.com>";
