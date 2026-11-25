import { describe, expect, it } from "vitest";
import { evaluarExportacionIngresos } from "@/lib/reportes/plan-exportacion";

const hoy = "2026-11-24";
const essential = { periodo: false, avanzados: false, consolidado: false };
const studio = { periodo: true, avanzados: false, consolidado: false };
const signature = { periodo: true, avanzados: true, consolidado: true };
const base = { hoy, sedesActivas: 1 };

describe("exportar reportes según plan", () => {
  it("Essential: sin parámetros → 200 forzado al día de hoy", () => {
    expect(evaluarExportacionIngresos({ ...base, funciones: essential })).toEqual({ ok: true, desde: hoy, hasta: hoy, agrupacion: "mes" });
  });
  it("Essential: hoy explícito → permitido", () => {
    expect(evaluarExportacionIngresos({ ...base, funciones: essential, desde: hoy, hasta: hoy }).ok).toBe(true);
  });
  it("Essential: semana/mes → 403", () => {
    expect(evaluarExportacionIngresos({ ...base, funciones: essential, agrupacion: "semana" }).ok).toBe(false);
    expect(evaluarExportacionIngresos({ ...base, funciones: essential, agrupacion: "mes" }).ok).toBe(false);
  });
  it("Essential: rango personalizado → 403", () => {
    expect(evaluarExportacionIngresos({ ...base, funciones: essential, desde: "2026-01-01", hasta: hoy }).ok).toBe(false);
    expect(evaluarExportacionIngresos({ ...base, funciones: essential, hasta: "2026-12-01" }).ok).toBe(false);
  });
  it("Studio: semana/mes y rangos permitidos; mes por defecto", () => {
    expect(evaluarExportacionIngresos({ ...base, funciones: studio, agrupacion: "semana", desde: "2026-01-01" })).toEqual({
      ok: true, desde: "2026-01-01", hasta: undefined, agrupacion: "semana",
    });
    expect(evaluarExportacionIngresos({ ...base, funciones: studio })).toMatchObject({ ok: true, agrupacion: "mes" });
  });
  it("multi-sede sin consolidado: exige sede; con sede o Signature → permitido", () => {
    const multi = { ...base, sedesActivas: 3 };
    expect(evaluarExportacionIngresos({ ...multi, funciones: studio }).ok).toBe(false);
    expect(evaluarExportacionIngresos({ ...multi, funciones: essential }).ok).toBe(false);
    expect(evaluarExportacionIngresos({ ...multi, funciones: studio, sedeId: "s1" }).ok).toBe(true);
    expect(evaluarExportacionIngresos({ ...multi, funciones: signature }).ok).toBe(true);
  });
});
