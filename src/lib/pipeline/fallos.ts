/**
 * El Pipeline de Eventos (migración 077) aísla los fallos de cada handler: la operación principal se confirma aunque un
 * efecto secundario (fidelidad, puntos de staff, cashback, auditoría) falle. El RPC devuelve `pipeline: [{handler, ok, error?}]`.
 * Esto lo vuelve visible: la acción principal sigue siendo exitosa, pero el usuario recibe un aviso y queda en el log del
 * servidor; en base queda además un evento_auditoria `PIPELINE_HANDLER_FALLO` para consulta y reproceso.
 * Nunca se expone el texto de error de la base al usuario.
 */
export function avisoPorFallosDePipeline(resultado: unknown, contexto: string): string | undefined {
  const lista = (resultado as { pipeline?: unknown } | null)?.pipeline;
  if (!Array.isArray(lista)) return undefined;
  const fallidos = lista.filter((h): h is { handler: string; ok: false; error?: string } => (h as { ok?: unknown })?.ok === false);
  if (fallidos.length === 0) return undefined;
  console.error(`[pipeline] ${contexto}: handlers con fallo`, fallidos.map((h) => ({ handler: h.handler, error: h.error })));
  return "Listo, pero algunos beneficios (puntos, sellos o registros) no se aplicaron. El equipo de StylerNow ya lo tiene registrado.";
}
