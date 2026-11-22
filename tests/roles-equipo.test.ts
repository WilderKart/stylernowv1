import { describe, expect, it } from "vitest";
import { PERMISOS_ADMIN_DELEGADO, derivarPermisosPanel } from "@/lib/auth/permission-registry";
import {
  ROLES_ASIGNABLES,
  capacidadesDeRol,
  derivarRolEquipo,
  mapearCapacidad,
  rolConsumeCupo,
} from "@/lib/auth/roles-equipo";

describe("derivarRolEquipo (espejo de la función SQL _rol_equipo)", () => {
  it("el propietario es BUSINESS_OWNER aunque tenga perfil profesional", () => {
    expect(derivarRolEquipo({ esPropietario: true, esAdmin: false, prestaServicios: true })).toBe("BUSINESS_OWNER");
    expect(derivarRolEquipo({ esPropietario: true, esAdmin: true, prestaServicios: false })).toBe("BUSINESS_OWNER");
  });
  it("administra y atiende -> ADMIN_BARBER; solo administra -> BUSINESS_ADMIN; solo atiende -> BARBER", () => {
    expect(derivarRolEquipo({ esPropietario: false, esAdmin: true, prestaServicios: true })).toBe("ADMIN_BARBER");
    expect(derivarRolEquipo({ esPropietario: false, esAdmin: true, prestaServicios: false })).toBe("BUSINESS_ADMIN");
    expect(derivarRolEquipo({ esPropietario: false, esAdmin: false, prestaServicios: true })).toBe("BARBER");
  });
});

describe("capacidades y cupo por rol", () => {
  it("los roles asignables son exactamente tres y ninguno se llama OWNER", () => {
    expect([...ROLES_ASIGNABLES].sort()).toEqual(["ADMIN_BARBER", "BARBER", "BUSINESS_ADMIN"]);
    expect([...ROLES_ASIGNABLES].some((r) => r.startsWith("OWNER"))).toBe(false);
  });
  it("solo los roles que atienden clientes ocupan cupo", () => {
    expect(rolConsumeCupo("BARBER")).toBe(true);
    expect(rolConsumeCupo("ADMIN_BARBER")).toBe(true);
    expect(rolConsumeCupo("BUSINESS_ADMIN")).toBe(false);
  });
  it("capacidadesDeRol es coherente con derivarRolEquipo (ida y vuelta) y nunca deja un rol sin capacidades", () => {
    for (const rol of ROLES_ASIGNABLES) {
      const c = capacidadesDeRol(rol);
      expect(c.esAdmin || c.prestaServicios).toBe(true); // check vinculo_capacidad_minima
      expect(derivarRolEquipo({ esPropietario: false, ...c })).toBe(rol);
    }
  });
});

describe("mapearCapacidad", () => {
  it("traduce la respuesta de la función central sin perder campos", () => {
    const c = mapearCapacidad({
      plan_codigo: "STUDIO",
      incluidos: 5,
      adicionales_contratados: 0,
      limite: 5,
      activos: 2,
      suspendidos: 1,
      pendientes_activacion: 0,
      invitaciones_pendientes: 1,
      operativos: 3,
      ocupados: 4,
      disponibles: 1,
      exceso: 0,
    });
    expect(c).toMatchObject({ limite: 5, ocupados: 4, disponibles: 1, exceso: 0, suspendidos: 1, invitacionesPendientes: 1, adicionalesContratados: 0 });
  });
  it("conserva null como 'sin tope'", () => {
    const c = mapearCapacidad({ plan_codigo: "X", incluidos: null, adicionales_contratados: 0, limite: null, activos: 0, suspendidos: 0, pendientes_activacion: 0, invitaciones_pendientes: 0, operativos: 0, ocupados: 0, disponibles: null, exceso: 0 });
    expect(c.limite).toBeNull();
    expect(c.disponibles).toBeNull();
  });
});

describe("permisos del administrador delegado (denegado por defecto)", () => {
  const admin = derivarPermisosPanel("admin");
  const propietario = derivarPermisosPanel("barberia");

  it("no recibe facturación, configuración, Guardian ni nada de servicios/clientes", () => {
    expect(admin.verFacturacion).toBe(false);
    expect(admin.verConfiguracionGlobal).toBe(false);
    expect(admin.promoverGuardian).toBe(false);
    expect(admin.revocarGuardian).toBe(false);
    expect(admin.crearSede).toBe(false);
    expect(admin.eliminarSede).toBe(false);
    expect(admin.crearServicio).toBe(false);
    expect(admin.cambiarPrecioServicio).toBe(false);
    expect(admin.exportarClientes).toBe(false);
  });
  it("recibe exactamente el conjunto mínimo de gestión del equipo", () => {
    expect(admin.invitarStaff).toBe(true);
    expect(admin.cancelarInvitacionStaff).toBe(true);
    expect(admin.suspenderStaff).toBe(true);
    expect(admin.reactivarStaff).toBe(true);
    expect(admin.retirarStaff).toBe(true);
    expect(admin.trasladarStaff).toBe(true);
    const activos = Object.entries(admin).filter(([, v]) => v).map(([k]) => k).sort();
    expect(activos).toEqual(["cancelarInvitacionStaff", "invitarStaff", "reactivarStaff", "retirarStaff", "suspenderStaff", "trasladarStaff", "verTodasLasSedes"]);
  });
  it("todo lo delegado ya lo tiene el propietario (nunca se delega algo que el propietario no puede)", () => {
    for (const [k, v] of Object.entries(admin)) {
      if (v) expect(propietario[k as keyof typeof propietario], k).toBe(true);
    }
  });
  it("la lista cerrada no contiene módulos de facturación ni de propiedad", () => {
    const lista = [...PERMISOS_ADMIN_DELEGADO];
    expect(lista.some((p) => p.startsWith("configuracion_negocio") || p.startsWith("admin_global") || p.includes("convertir_guardian"))).toBe(false);
  });
  it("Barbería y Guardian se derivan igual que antes (sin regresión)", () => {
    expect(propietario.verFacturacion).toBe(true);
    expect(propietario.promoverGuardian).toBe(true);
    const guardian = derivarPermisosPanel("guardian");
    expect(guardian.verFacturacion).toBe(false);
    expect(guardian.invitarStaff).toBe(false);
  });
});
