import { describe, expect, it } from "vitest";
import { compararVersiones, versionesLocales } from "../tools/verificar-paridad-migraciones.mjs";

describe("Fase 4 · paridad de migraciones", () => {
  it("acepta conjuntos idénticos con distinto orden", () => {
    expect(
      compararVersiones(["001", "140", "182"], ["182", "001", "140"]),
    ).toEqual({ faltantes: [], sobrantes: [] });
  });

  it("detecta versiones ausentes y extrañas", () => {
    expect(compararVersiones(["001", "140", "182"], ["001", "182", "999"])).toEqual({
      faltantes: ["140"],
      sobrantes: ["999"],
    });
  });

  it("lee solo migraciones .sql con prefijo numérico", () => {
    const versiones = versionesLocales("supabase/migrations");

    expect(versiones).toContain("001");
    expect(versiones).toContain("182");
    expect(versiones).toContain("20261111000000");
    expect(versiones).not.toContain("091b");
    expect(versiones).not.toContain("182_reserva_idempotencia_atomica");
  });
});
