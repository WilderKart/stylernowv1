import { describe, expect, it } from "vitest";
import { patronSinTildes } from "@/lib/busqueda/sin-tildes";

/** Réplica mínima de ILIKE para comprobar el patrón: `_` = un carácter, `%` = cualquiera. */
function ilike(valor: string, patron: string) {
  const re = [...patron].map((c) => (c === "_" ? "." : c === "%" ? ".*" : c.replace(/W/g, "\$&"))).join("");
  return new RegExp("^" + re + "$", "i").test(valor);
}

describe("patronSinTildes", () => {
  it("encuentra con y sin tilde en ambos sentidos", () => {
    expect(ilike("Barbería Kevin", `%${patronSinTildes("barberia")}%`)).toBe(true);
    expect(ilike("Barberia Kevin", `%${patronSinTildes("barbería")}%`)).toBe(true);
    expect(ilike("Medellín", `%${patronSinTildes("MEDELLIN")}%`)).toBe(true);
  });
  it("no deja pasar caracteres especiales del filtro", () => {
    expect(patronSinTildes("a%b,c(d)")).not.toMatch(/[%,()]/);
  });
  it("no coincide con otra palabra", () => {
    expect(ilike("Peluquería", `%${patronSinTildes("barberia")}%`)).toBe(false);
  });
});
