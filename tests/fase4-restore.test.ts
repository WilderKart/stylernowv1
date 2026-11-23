import { describe, expect, it } from "vitest";
import { compararConteos } from "../tools/restaurar-backup.mjs";

describe("Fase 4 · simulacro de restauración", () => {
  const esperados = {
    migraciones: 182,
    usuarios: 284,
    textos_legales: 9,
    ultima_migracion: "182",
  };

  it("acepta conteos idénticos", () => {
    expect(compararConteos(esperados, esperados)).toEqual([]);
  });

  it("informa cada divergencia", () => {
    const obtenidos = { ...esperados, usuarios: 283, ultima_migracion: "181" };

    expect(compararConteos(obtenidos, esperados)).toEqual([
      "usuarios: esperado 284, obtenido 283",
      "ultima_migracion: esperado 182, obtenido 181",
    ]);
  });
});
