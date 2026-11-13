import type { Rol } from "@/lib/auth/tipos";

/**
 * Fuente única de rutas — ADR-015, Fase B/C. `docs/ROUTE_REGISTRY.md` se
 * GENERA desde este archivo (`scripts/check-route-registry.mjs` también lo
 * usa para fallar el build si una ruta nueva no quedó documentada aquí).
 * `proxy.ts` lo importa en runtime (Edge, sin DB) solo para decidir
 * público/protegido — nunca resuelve rol/onboarding/permisos desde aquí.
 */

export interface RutaRegistro {
  path: string;
  publica: boolean;
  roles?: Rol[];
  dinamica?: boolean;
}

export const RUTAS: RutaRegistro[] = [
  // Cliente — públicas
  { path: "/", publica: true },
  { path: "/login", publica: true },
  { path: "/legal", publica: true, dinamica: true },
  { path: "/negocio", publica: true, dinamica: true },
  { path: "/onboarding", publica: true },
  { path: "/mantenimiento", publica: true },
  // Landing B2B (W01): precios por país, cupos fundador y alta del negocio. Pública.
  { path: "/para-negocios", publica: true },
  // El usuario llega aquí SIN sesión todavía (magic link, recuperación de
  // contraseña, callback de Google) — esta ruta es justamente quien la crea.
  // Encontrado como regresión real durante ADR-015 Fase D: sin esta entrada,
  // el middleware lo trataba como protegido (fail-closed) y redirigía a
  // /login ANTES de que /auth/callback pudiera intercambiar el código,
  // rompiendo los 3 flujos.
  { path: "/auth/callback", publica: true },

  // Cliente — protegidas
  { path: "/perfil", publica: false, roles: ["cliente", "staff", "guardian", "barberia"] },
  { path: "/favoritos", publica: false, roles: ["cliente"] },
  { path: "/mis-reservas", publica: false, roles: ["cliente"] },
  { path: "/lealtad", publica: false, roles: ["cliente"] },
  { path: "/login/recuperar", publica: false, roles: ["cliente", "staff", "guardian", "barberia"] },
  { path: "/membresias", publica: false, roles: ["cliente"] },
  // Pantallas del cliente C01-C17 (prototipo StylerNow-codigo)
  { path: "/notificaciones", publica: false, roles: ["cliente"] },
  { path: "/ajustes", publica: false, roles: ["cliente"] },
  { path: "/ayuda", publica: false, roles: ["cliente"] },
  { path: "/privacidad", publica: false, roles: ["cliente"] },
  { path: "/cuenta", publica: false, roles: ["cliente"] },
  { path: "/mi-look", publica: false, roles: ["cliente"] },
  { path: "/pagos", publica: false, roles: ["cliente"] },
  { path: "/referidos", publica: false, roles: ["cliente"] },
  { path: "/ofertas", publica: false, roles: ["cliente"] },
  { path: "/gift-cards", publica: false, roles: ["cliente"] },
  { path: "/checkout/membresia", publica: false, roles: ["cliente"], dinamica: true },
  { path: "/reserva", publica: false, roles: ["cliente"], dinamica: true },
  { path: "/invitacion", publica: false, roles: ["staff", "cliente"], dinamica: true },

  // Panel — Barbería/Guardian
  { path: "/panel", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/onboarding", publica: false, roles: ["barberia"] },
  { path: "/panel/sedes", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/staff", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/servicios", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/agenda", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/crm", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/pos", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/inventario", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/soporte", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/auditoria", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/wallet", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/ads", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/marca", publica: false, roles: ["barberia"] },
  { path: "/panel/suscripcion", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/reportes", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/lealtad", publica: false, roles: ["barberia", "guardian"] },
  { path: "/panel/ia", publica: false, roles: ["barberia", "guardian"] },
  // Modulo de WhatsApp (migracion 120): solo el dueño (la pagina usa verificarAccesoPanel(["BARBERIA"])).
  { path: "/panel/whatsapp", publica: false, roles: ["barberia"] },
  { path: "/panel/politica", publica: false, roles: ["barberia"] },
  { path: "/panel/cobros", publica: false, roles: ["barberia"] },
  { path: "/panel/libro", publica: false, roles: ["barberia"] },

  // Staff
  { path: "/staff", publica: false, roles: ["staff", "guardian"] },

  // SuperSU
  { path: "/admin", publica: false, roles: ["supersu"] },

  // Estáticos/PWA excluidos del matcher de proxy.ts, no necesitan entrada aquí.
];

/** Empareja por prefijo (`/panel/staff/nuevo` matchea la entrada `/panel/staff`). */
export function buscarRuta(pathname: string): RutaRegistro | undefined {
  const candidatas = RUTAS.filter((r) => pathname === r.path || pathname.startsWith(`${r.path}/`));
  // La coincidencia más específica (path más largo) gana.
  return candidatas.sort((a, b) => b.path.length - a.path.length)[0];
}

export function esRutaPublica(pathname: string): boolean {
  const ruta = buscarRuta(pathname);
  // Sin entrada en el registro: por seguridad, se trata como protegida
  // (fail-closed) — el build falla igual vía check-route-registry.mjs si
  // falta documentar una ruta nueva de src/app.
  return ruta?.publica ?? false;
}
