import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGO_SERVICIOS, CATEGORIAS_CATALOGO, categoriaDe, normalizar } from "@/lib/servicios/catalogo";

// Misma regla que la base (servicio_imagen_url_valida y servicio_crear_desde_catalogo).
const RUTA_VALIDA = /^\/servicios\/[a-z]+\/[A-Za-z0-9%._()-]+\.webp$/;

describe("catálogo de servicios", () => {
  it("no está vacío y cada servicio tiene nombre, categoría e imagen", () => {
    expect(CATALOGO_SERVICIOS.length).toBeGreaterThan(50);
    for (const s of CATALOGO_SERVICIOS) {
      expect(s.nombre.trim().length).toBeGreaterThan(1);
      expect(s.categoria).toMatch(/^[a-z]+$/);
    }
  });
  it("las claves son únicas (si no, dos servicios compartirían «ya agregado»)", () => {
    const ids = CATALOGO_SERVICIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("cada imagen existe en public/ y cumple la regla de la base", () => {
    for (const s of CATALOGO_SERVICIOS) {
      expect(s.imagen, s.id).toMatch(RUTA_VALIDA);
      expect(existsSync(join(process.cwd(), "public", decodeURIComponent(s.imagen))), s.imagen).toBe(true);
    }
  });
  it("cada categoría con servicios tiene metadatos (etiqueta y duración sugerida)", () => {
    expect(CATEGORIAS_CATALOGO.length).toBeGreaterThanOrEqual(5);
    for (const c of CATEGORIAS_CATALOGO) {
      expect(c.etiqueta.length).toBeGreaterThan(2);
      expect(c.duracionSugerida).toBeGreaterThanOrEqual(5);
    }
    expect(categoriaDe("categoria-que-no-existe").duracionSugerida).toBe(30);
  });
  it("la búsqueda ignora tildes y mayúsculas", () => {
    expect(normalizar("  Tazón ")).toBe("tazon");
    expect(CATALOGO_SERVICIOS.some((s) => normalizar(s.nombre).includes("tazon"))).toBe(true);
    expect(CATALOGO_SERVICIOS.some((s) => normalizar(s.nombre).includes("unas"))).toBe(true);
  });
  it("no incluye archivos de trabajo (capturas de otras herramientas)", () => {
    expect(CATALOGO_SERVICIOS.some((s) => /chatgpt/i.test(s.id))).toBe(false);
  });
});
