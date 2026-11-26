import { describe, expect, it } from "vitest";
import { esCategoriaRegistro, OPCIONES_SERVICIO_REGISTRO, TEMAS_POR_CATEGORIA_ACTIVOS, verticalDeCategorias } from "@/lib/tema/vertical";
import { temaEfectivo } from "@/lib/tema/preferencia";

describe("verticalDeCategorias", () => {
  it("identidad única: con los temas por categoría apagados ninguna categoría cambia el diseño", () => {
    if (TEMAS_POR_CATEGORIA_ACTIVOS) return;
    for (const cat of ["spa", "salon", "manicura", "barberia", "tatuajes"]) expect(verticalDeCategorias([cat])).toBeNull();
  });
  it("barbería y tattoo conservan el diseño original", () => {
    expect(verticalDeCategorias(["barberia"])).toBeNull();
    expect(verticalDeCategorias(["tatuajes"])).toBeNull();
    expect(verticalDeCategorias(["grooming"])).toBeNull();
  });
  it.skipIf(!TEMAS_POR_CATEGORIA_ACTIVOS)("spa, salón y uñas tienen tema propio", () => {
    expect(verticalDeCategorias(["spa"])).toBe("spa");
    expect(verticalDeCategorias(["masajes"])).toBe("spa");
    expect(verticalDeCategorias(["salon"])).toBe("salon");
    expect(verticalDeCategorias(["manicura"])).toBe("unas");
    expect(verticalDeCategorias(["lashista"])).toBe("unas");
  });
  it.skipIf(!TEMAS_POR_CATEGORIA_ACTIVOS)("manda la primera categoría", () => {
    expect(verticalDeCategorias(["barberia", "manicura", "grooming"])).toBeNull();
    expect(verticalDeCategorias(["manicura", "barberia"])).toBe("unas");
  });
  it.skipIf(!TEMAS_POR_CATEGORIA_ACTIVOS)("tolera vacío, nulo y mayúsculas", () => {
    expect(verticalDeCategorias(null)).toBeNull();
    expect(verticalDeCategorias([])).toBeNull();
    expect(verticalDeCategorias([" SPA "])).toBe("spa");
  });
});

describe("temaEfectivo", () => {
  it("respeta la elección explícita", () => {
    expect(temaEfectivo("dark", "light")).toBe("dark");
    expect(temaEfectivo("light", "dark")).toBe("light");
  });
  it("en automático usa lo que declaró el dispositivo", () => {
    expect(temaEfectivo("auto", "dark")).toBe("dark");
    expect(temaEfectivo("auto", undefined)).toBe("light");
  });
  it("sin cookie, claro (comportamiento anterior)", () => {
    expect(temaEfectivo(undefined, "dark")).toBe("light");
    expect(temaEfectivo("raro", "dark")).toBe("light");
  });
});

describe("categoría elegida al crear la cuenta", () => {
  it("solo acepta las opciones ofrecidas", () => {
    for (const o of OPCIONES_SERVICIO_REGISTRO) expect(esCategoriaRegistro(o.valor)).toBe(true);
    expect(esCategoriaRegistro("grooming")).toBe(false);
    expect(esCategoriaRegistro("<script>")).toBe(false);
    expect(esCategoriaRegistro(undefined)).toBe(false);
  });
  it.skipIf(!TEMAS_POR_CATEGORIA_ACTIVOS)("cada opción de spa, salón y uñas tiene tema; barbería y tattoo no", () => {
    expect(OPCIONES_SERVICIO_REGISTRO.map((o) => verticalDeCategorias([o.valor]))).toEqual([null, null, "salon", "spa", "unas"]);
  });
});

describe("categoriaDeAspecto", () => {
  it("lleva categorías afines a una de las cinco opciones", async () => {
    const { categoriaDeAspecto } = await import("@/lib/tema/vertical");
    expect(categoriaDeAspecto("estilismo")).toBe("salon");
    expect(categoriaDeAspecto("masajes")).toBe("spa");
    expect(categoriaDeAspecto("lashista")).toBe("manicura");
    expect(categoriaDeAspecto("tatuajes")).toBe("tatuajes");
    expect(categoriaDeAspecto("<x>")).toBeNull();
    expect(categoriaDeAspecto(null)).toBeNull();
  });
});
