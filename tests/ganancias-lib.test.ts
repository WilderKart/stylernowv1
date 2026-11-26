import { describe, expect, it } from "vitest";
import { aCsv, celdaCsv } from "@/lib/ganancias/csv";
import { argumentosListar, leerFiltros, rangoRapido } from "@/lib/ganancias/filtros";

describe("CSV de ganancias", () => {
  it("neutraliza fórmulas en texto pero no toca números negativos", () => {
    expect(celdaCsv("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(celdaCsv("+57 300")).toBe("'+57 300");
    expect(celdaCsv("@cmd")).toBe("'@cmd");
    expect(celdaCsv(-2000)).toBe("-2000");
  });
  it("escapa comas, comillas y saltos de línea", () => {
    expect(celdaCsv('Corte, "fade"')).toBe('"Corte, ""fade"""');
    expect(celdaCsv("a\nb")).toBe('"a\nb"');
    expect(celdaCsv(null)).toBe("");
  });
  it("arma el archivo con BOM y CRLF", () => {
    const t = aCsv(["a", "b"], [[1, "x"]]);
    expect(t.startsWith("﻿")).toBe(true);
    expect(t).toContain("a,b\r\n1,x\r\n");
  });
});

describe("filtros de ganancias", () => {
  const HOY = "2026-11-26"; // jueves
  it("calcula los rangos rápidos", () => {
    expect(rangoRapido("hoy", HOY)).toEqual({ desde: HOY, hasta: HOY });
    expect(rangoRapido("ayer", HOY)).toEqual({ desde: "2026-11-25", hasta: "2026-11-25" });
    expect(rangoRapido("semana", HOY)).toEqual({ desde: "2026-11-23", hasta: HOY });
    expect(rangoRapido("semana_anterior", HOY)).toEqual({ desde: "2026-11-16", hasta: "2026-11-22" });
    expect(rangoRapido("mes", HOY)).toEqual({ desde: "2026-11-01", hasta: HOY });
    expect(rangoRapido("mes_anterior", HOY)).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(rangoRapido("nada", HOY)).toBeNull();
  });
  it("ignora valores inválidos en lugar de enviarlos a la base", () => {
    const f = leerFiltros({ sede: "no-es-uuid", desde: "ayer", estado_comision: "HACKEADO", pagina: "-4", q: "x".repeat(200) }, HOY);
    expect(f.sede).toBeUndefined();
    expect(f.desde).toBeUndefined();
    expect(f.estadoComision).toBeUndefined();
    expect(f.pagina).toBe(1);
    expect(f.q).toBeUndefined();
  });
  it("acepta filtros válidos y arma el desplazamiento", () => {
    const sede = "c0000001-0000-4000-8000-000000000001";
    const f = leerFiltros({ sede, estado_comision: "PENDIENTE", rapido: "mes", pagina: "3" }, HOY);
    expect(f.sede).toBe(sede);
    expect(f.desde).toBe("2026-11-01");
    const a = argumentosListar(f, "n1");
    expect(a.p_desplazamiento).toBe(50);
    expect(a.p_negocio).toBe("n1");
    expect(a.p_estado_comision).toBe("PENDIENTE");
  });
});
