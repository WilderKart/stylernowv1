import "server-only";
import { redirect, forbidden } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { obtenerContextoStaff } from "@/lib/auth/require-staff";
import { requireSuperSU } from "@/lib/auth/require-supersu";
import { PERMISOS_NINGUNO_CONTEXTO } from "@/lib/auth/tipos";
import type { Contexto, Rol } from "@/lib/auth/tipos";

/**
 * ADR-015 — único punto de entrada de autorización que una página/layout
 * debe llamar. NO fusiona `resolverContexto()` / `obtenerContextoStaff()` /
 * `requireSuperSU()` (ADL-011/015/019 los mantienen deliberadamente
 * separados) — decide cuál de los tres usar según los roles pedidos, y
 * homogeniza su salida al contrato `Contexto` único.
 *
 * Onboarding: SOLO bloquea cuando `rol === "barberia" && !onboardingCompleto`.
 * Nunca para guardian/staff/cliente/supersu — esto es lo que corrige, a nivel
 * estructural, el riesgo que motivó el ADR (una superficie ajena cayendo en
 * `/panel/onboarding`), aunque la auditoría no encontró el bug ya ocurriendo.
 */
export async function requireRole(roles: Rol[], opciones?: { next?: string }): Promise<Contexto> {
  if (roles.includes("supersu")) return await viaSuperSU();

  const esSoloStaffAppSurface = roles.some((r) => r === "staff" || r === "guardian") && !roles.includes("barberia");
  if (esSoloStaffAppSurface) return await viaStaff(roles);

  if (roles.includes("barberia") || roles.includes("guardian")) return await viaPanel(roles, opciones?.next);

  // Rutas de Cliente puro (perfil, mis-reservas, favoritos, lealtad, checkout):
  // solo exigen sesión — cualquier rol de negocio puede además ser Cliente.
  return await viaCliente(opciones?.next);
}

async function viaSuperSU(): Promise<Contexto> {
  const { userId } = await requireSuperSU(); // ya redirige 401→/login, 403→/panel
  return {
    userId,
    rol: "supersu",
    onboardingCompleto: true,
    estadoCuenta: "activo",
    permisos: PERMISOS_NINGUNO_CONTEXTO, // SuperSU no usa este shape — "sin restricciones" se resuelve en RLS/RPC.
    sesion: { id: "", trusted: false, riskScore: 0, aal: "aal1" }, // completado en Fase G/F.
  };
}

async function viaStaff(rolesSolicitados: Rol[]): Promise<Contexto> {
  const contexto = await obtenerContextoStaff(); // ya redirige a /login si no hay sesión
  if (!contexto) {
    // Sin vínculo activo: NO es un 403 — es un estado legítimo que el propio
    // layout de /staff ya renderiza (Sin vínculos / Suspendido / Invitado).
    // requireRole() deja pasar un Contexto vacío; el layout decide la vista.
    return {
      userId: "",
      rol: "staff",
      onboardingCompleto: true,
      estadoCuenta: "pendiente",
      permisos: PERMISOS_NINGUNO_CONTEXTO,
      sesion: { id: "", trusted: false, riskScore: 0, aal: "aal1" },
    };
  }
  const rol: Rol = contexto.esGuardian ? "guardian" : "staff";
  if (!rolesSolicitados.includes(rol)) forbidden(); // pidió staff-only y es guardian, o viceversa.
  return {
    userId: contexto.userId,
    rol,
    negocioId: contexto.negocioId,
    sedeId: contexto.sedeId ?? undefined,
    onboardingCompleto: true,
    estadoCuenta: contexto.estadoVinculo === "SUSPENDIDO" ? "suspendido" : "activo",
    estadoStaff: contexto.estadoVinculo === "SUSPENDIDO" ? "suspendido" : contexto.estadoVinculo === "INVITADO" ? "invitado" : "activo",
    permisos: PERMISOS_NINGUNO_CONTEXTO, // La App Staff usa RLS por staff_id, no este objeto de permisos de Panel.
    sesion: { id: "", trusted: false, riskScore: 0, aal: "aal1" },
  };
}

async function viaPanel(rolesSolicitados: Rol[], next?: string): Promise<Contexto> {
  const contexto = await resolverContexto(); // pura, nunca redirige (Fase A)

  if (!contexto.userId) redirect(destinoSeguro(next ?? "/panel"));

  if (contexto.rol === "NINGUNO") redirect(destinoSeguro("/panel/onboarding"));
  if (contexto.rol === "STAFF") forbidden(); // Staff plano no tiene lugar en el Panel — su superficie es /staff.

  const rol: Rol = contexto.rol === "GUARDIAN" ? "guardian" : "barberia";
  if (!rolesSolicitados.includes(rol)) forbidden();

  // Onboarding: únicamente aplica a Barbería, nunca a Guardian.
  // (La verificación de `negocio.onboarding_completo` en sí ya vive en cada
  // página que la necesita, vía `resolverContexto()` + su propia consulta —
  // acá solo se documenta la regla para que quede explícita y auditable.)

  return {
    userId: contexto.userId,
    rol,
    negocioId: contexto.negocioId ?? undefined,
    sedeId: contexto.sedeId ?? undefined,
    onboardingCompleto: true,
    estadoCuenta: "activo",
    permisos: contexto.permisos,
    sesion: { id: "", trusted: false, riskScore: 0, aal: "aal1" },
  };
}

async function viaCliente(next?: string): Promise<Contexto> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(destinoSeguro(next ?? "/login"));
  return {
    userId: user.id,
    rol: "cliente",
    onboardingCompleto: true,
    estadoCuenta: "activo",
    permisos: PERMISOS_NINGUNO_CONTEXTO,
    sesion: { id: "", trusted: false, riskScore: 0, aal: "aal1" },
  };
}
