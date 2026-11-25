import { describe, expect, it } from "vitest";
import { distancia, normalizar, puntuar } from "@/lib/busqueda/difuso";

describe("búsqueda difusa del panel", () => {
  it("ignora tildes y mayúsculas", () => {
    expect(normalizar("  Ánge-Lica  PÉREZ ")).toBe("ange lica perez");
    expect(puntuar("jose", ["José Pérez"])?.aproximada).toBe(false);
    expect(puntuar("perez", ["José Pérez"])).not.toBeNull();
  });
  it("coincide por prefijo y por subcadena", () => {
    expect(puntuar("man", ["Manicure semipermanente"])!.puntaje).toBeGreaterThan(puntuar("cure", ["Manicure semipermanente"])!.puntaje);
  });
  it("tolera errores de tecleo y los marca como aproximados", () => {
    const r = puntuar("manicur", ["Manicura rusa"]);
    expect(r).not.toBeNull();
    const m = puntuar("mancure", ["Manicure"]);
    expect(m?.aproximada).toBe(true);
  });
  it("exige todas las palabras", () => {
    expect(puntuar("ana lopez", ["Ana Gómez"])).toBeNull();
    expect(puntuar("ana gomez", ["Ana Gómez"])).not.toBeNull();
  });
  it("no devuelve nada si no hay parecido", () => {
    expect(puntuar("zzzz", ["Corte de cabello"])).toBeNull();
  });
  it("busca teléfonos sin importar espacios", () => {
    expect(puntuar("3001234567", ["300 123 4567"])).not.toBeNull();
  });
  it("distancia con tope", () => {
    expect(distancia("gato", "pato")).toBe(1);
    expect(distancia("abc", "abcdefgh")).toBeGreaterThan(2);
  });
});
