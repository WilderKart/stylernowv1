import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  DESCONOCIDO,
  esErrorRestriccion,
  interpretarEstadoOperativo,
  MENSAJE_RESTRINGIDA,
  traducirErrorRestriccion,
} from "@/lib/suscripcion/estado-operativo-puro";

// El espejo TypeScript NO recalcula nada: solo da forma a lo que devuelve la función SQL negocio_estado_operativo (migración 160).

describe("interpretarEstadoOperativo (espejo de negocio_estado_operativo)", () => {
  it("lee un negocio operativo en prueba", () => {
    const e = interpretarEstadoOperativo({
      operativo: true, estado: "PRUEBA", motivo: null, suscripcion_estado: "TRIAL", plan_codigo: "STUDIO",
      limite_servicio: "2026-11-15T05:00:00+00:00", bloqueo_desde: "2026-11-15T05:00:00+00:00", dia_ciclo: 3, dias_restantes: 12, puede_pagar: true,
    });
    expect(e.operativo).toBe(true);
    expect(e.estado).toBe("PRUEBA");
    expect(e.diaCiclo).toBe(3);
    expect(e.planCodigo).toBe("STUDIO");
  });
  it("lee un negocio restringido con su motivo y que puede pagar", () => {
    const e = interpretarEstadoOperativo({ operativo: false, estado: "RESTRINGIDO", motivo: "PERIODO_VENCIDO", puede_pagar: true });
    expect(e.operativo).toBe(false);
    expect(e.motivo).toBe("PERIODO_VENCIDO");
    expect(e.puedePagar).toBe(true);
  });
  it("la gracia opera pero se distingue del periodo pagado", () => {
    const e = interpretarEstadoOperativo({ operativo: true, estado: "GRACIA", motivo: "PERIODO_VENCIDO" });
    expect(e.operativo).toBe(true);
    expect(e.estado).toBe("GRACIA");
  });
  it("una suspensión por infracción no puede pagar", () => {
    expect(interpretarEstadoOperativo({ operativo: false, estado: "RESTRINGIDO", motivo: "SUSPENDIDA", puede_pagar: false }).puedePagar).toBe(false);
  });
  it("el detalle recortado que ve un tercero (sin motivo ni fechas) no inventa datos", () => {
    const e = interpretarEstadoOperativo({ operativo: false, estado: "RESTRINGIDO" });
    expect(e.motivo).toBeNull();
    expect(e.limiteServicio).toBeNull();
    expect(e.diaCiclo).toBeNull();
  });
  it.each([null, undefined, "x", 3, []])("una respuesta inválida (%j) se trata como restringido (falla cerrado)", (crudo) => {
    const e = interpretarEstadoOperativo(crudo);
    expect(e.operativo).toBe(false);
    expect(e).toEqual(DESCONOCIDO);
  });
  it("«operativo» solo es verdadero si la base manda exactamente true", () => {
    expect(interpretarEstadoOperativo({ operativo: "true" }).operativo).toBe(false);
    expect(interpretarEstadoOperativo({ operativo: 1 }).operativo).toBe(false);
  });
});

describe("errores del bloqueo operativo", () => {
  it("reconoce el error de los disparadores/RPC y el de la guardia anterior de reservas", () => {
    expect(esErrorRestriccion("SUSCRIPCION_RESTRINGIDA")).toBe(true);
    expect(esErrorRestriccion("ERROR: SUSCRIPCION_RESTRINGIDA (P0001)")).toBe(true);
    expect(esErrorRestriccion("NEGOCIO_REQUIERE_PLAN")).toBe(true);
    expect(esErrorRestriccion("SLOT_NO_DISPONIBLE")).toBe(false);
    expect(esErrorRestriccion(null)).toBe(false);
  });
  it("traduce al mensaje amigable y deja intactos los demás", () => {
    expect(traducirErrorRestriccion("SUSCRIPCION_RESTRINGIDA")).toBe(MENSAJE_RESTRINGIDA);
    expect(traducirErrorRestriccion("PLAN_LIMIT_EXCEEDED")).toBe("PLAN_LIMIT_EXCEEDED");
  });
});

describe("una sola fuente de verdad (sin cálculos de fechas de suscripción fuera de la base)", () => {
  const raiz = path.resolve(__dirname, "..");
  const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

  it("el espejo TypeScript no hace aritmética de fechas", () => {
    for (const f of ["src/lib/suscripcion/estado-operativo-puro.ts", "src/lib/suscripcion/estado-operativo.ts", "src/components/panel/banner-suscripcion.tsx"]) {
      const c = leer(f);
      expect(c, f).not.toMatch(/new Date\(|Date\.now\(|getTime\(|setDate\(|86400000/);
    }
  });
  it("las migraciones del ciclo (161) usan la función central de fechas, no intervalos sueltos", () => {
    const m = leer("supabase/migrations/161_suscripcion_ciclo_30_dias_bogota.sql");
    expect(m).toContain("suscripcion_fecha_limite");
    expect(m).not.toMatch(/interval '1 month'/);
  });
  it("las migraciones 160-164 existen con su reversión", () => {
    const dir = path.join(raiz, "supabase/migrations");
    const archivos = readdirSync(dir);
    for (const n of ["160", "161", "162", "163", "164"]) {
      expect(archivos.some((a) => a.startsWith(`${n}_`) && a.endsWith(".sql")), `falta ${n}`).toBe(true);
      expect(archivos.some((a) => a.startsWith(`${n}_`) && a.endsWith("_REVERSION.sql.txt")), `falta reversión ${n}`).toBe(true);
    }
  });
  it("la pantalla pública y el flujo de reserva consultan el estado a la base", () => {
    expect(leer("src/app/negocio/[slug]/page.tsx")).toContain("negocioAceptaReservas");
    expect(leer("src/app/negocio/[slug]/reservar/page.tsx")).toContain("negocioAceptaReservas");
  });
  it("el panel y la pantalla de cumplimiento leen el estado de la base y la ruta está registrada", () => {
    expect(leer("src/app/panel/layout.tsx")).toContain("obtenerEstadoOperativo");
    expect(leer("src/app/panel/cumplimiento/page.tsx")).toContain("obtenerEstadoOperativo");
    expect(leer("src/lib/routing/route-registry.ts")).toContain("/panel/cumplimiento");
  });
});
