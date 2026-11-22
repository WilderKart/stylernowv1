import { ciudadesCoinciden, dentroDelPais } from "@/lib/geo/coherencia";
import { describe, expect, it } from "vitest";

describe("dentroDelPais", () => {
  it("acepta un punto de Cali en Colombia", () => expect(dentroDelPais("CO", 3.4516, -76.532)).toBe(true));
  it("rechaza Madrid declarado como Colombia", () => expect(dentroDelPais("CO", 40.4168, -3.7038)).toBe(false));
  it("rechaza la isla nula, valores no finitos y fuera de rango", () => {
    expect(dentroDelPais("CO", 0, 0)).toBe(false);
    expect(dentroDelPais("CO", Number.NaN, -76)).toBe(false);
    expect(dentroDelPais("CO", 91, 10)).toBe(false);
    expect(dentroDelPais("CO", 3, 181)).toBe(false);
  });
  it("acepta Ciudad de México en MX y Miami en US", () => {
    expect(dentroDelPais("MX", 19.4326, -99.1332)).toBe(true);
    expect(dentroDelPais("US", 25.7617, -80.1918)).toBe(true);
  });
});

describe("ciudadesCoinciden", () => {
  it("ignora tildes, mayúsculas y sufijos oficiales", () => {
    expect(ciudadesCoinciden("Cali", "Santiago de Cali")).toBe(true);
    expect(ciudadesCoinciden("Bogota", "Bogotá, D.C.")).toBe(true);
    expect(ciudadesCoinciden("MEDELLÍN", "medellin")).toBe(true);
  });
  it("rechaza ciudades distintas y vacías", () => {
    expect(ciudadesCoinciden("Cali", "Bogotá")).toBe(false);
    expect(ciudadesCoinciden("", "Cali")).toBe(false);
  });
});
