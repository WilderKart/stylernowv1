import { describe, expect, it } from "vitest";
import { crearTraductor, esIdioma } from "@/lib/i18n/diccionario";

describe("i18n", () => {
  it("traduce y sustituye variables", () => {
    expect(crearTraductor("es")("comun.pagina", { n: 3 })).toBe("Página 3");
    expect(crearTraductor("en")("comun.pagina", { n: 3 })).toBe("Page 3");
  });
  it("es y en tienen las mismas claves con texto", () => {
    const es = crearTraductor("es");
    const en = crearTraductor("en");
    for (const clave of ["nav.explorar", "nav.mapa", "nav.citas", "nav.favoritos", "nav.perfil", "home.sin_resultados"] as const) {
      expect(es(clave).length).toBeGreaterThan(0);
      expect(en(clave).length).toBeGreaterThan(0);
      expect(en(clave)).not.toBe(es(clave));
    }
  });
  it("valida el idioma", () => {
    expect(esIdioma("en")).toBe(true);
    expect(esIdioma("pt")).toBe(false);
  });
});
