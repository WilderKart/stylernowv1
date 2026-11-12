import type { PlanPais } from "./catalogo";

/**
 * Textos de "qué incluye" por característica. Los datos (qué plan tiene qué) salen de la BD
 * (plan_caracteristica); aquí solo viven las etiquetas de presentación, centralizadas para
 * traducirlas cuando exista i18n.
 */
const ETIQUETAS: Record<string, string> = {
  perfil_mapa: "Perfil público en el mapa",
  reservas_agenda: "Reservas con agenda real",
  anticipo: "Reserva segura con anticipo",
  recordatorios: "Recordatorios push y email",
  gift_cards: "Gift cards",
  crm_caja: "CRM de clientes y caja diaria",
  fila_virtual: "Fila virtual",
  comisiones_turnos: "Comisiones, turnos y propinas",
  inventario: "Inventario",
  roles_permisos: "Roles y permisos",
  fidelizacion: "Fidelización con puntos",
  migracion_datos: "Migración de datos",
  camara_antes_despues: "Cámara antes y después",
  my_look: "Galería del cliente My Look",
  reportes: "Reportes",
  soporte: "Soporte",
};

const VALORES: Record<string, string> = {
  destacado: "con pin destacado",
  ilimitados: "ilimitados",
  basico: "básico",
  completo: "completo",
  avanzado: "avanzados",
  por_sede: "por sede",
  basica: "básica",
  avanzada: "avanzada (membresías)",
  con_marca_agua: "con marca de agua",
  sin_marca_agua: "sin marca de agua",
  asistida: "asistida",
  dia: "del día",
  semana_mes: "semana y mes",
  avanzados: "avanzados",
  consolidados: "consolidados por sede",
  email: "por email",
  chat: "por chat",
  prioritario: "prioritario",
  gerente: "gerente dedicado",
};

export const ORDEN_CARACTERISTICAS = Object.keys(ETIQUETAS);

/** Líneas "incluye" de un plan, solo las habilitadas, en orden estable. */
export function lineasIncluye(plan: PlanPais): string[] {
  const lineas: string[] = [];
  if (plan.staffIncluido != null) lineas.push(`${plan.staffIncluido} ${plan.staffIncluido === 1 ? "profesional" : "profesionales"}`);
  if (plan.limiteSedes != null) lineas.push(`${plan.limiteSedes} ${plan.limiteSedes === 1 ? "sede" : "sedes"}`);
  for (const clave of ORDEN_CARACTERISTICAS) {
    const c = plan.caracteristicas[clave];
    if (!c?.habilitado) continue;
    const valor = c.valor ? VALORES[c.valor] : null;
    lineas.push(valor ? `${ETIQUETAS[clave]}: ${valor}` : ETIQUETAS[clave]);
  }
  return lineas;
}

export function llamadoAccion(plan: PlanPais): "prueba" | "ventas" {
  return plan.caracteristicas.llamado_accion?.valor === "ventas" ? "ventas" : "prueba";
}
