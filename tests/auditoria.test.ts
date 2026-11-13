import { describe, expect, it } from "vitest";
import { diferencias, esquemaFiltros, rangoFechas } from "@/lib/auditoria/listado";

describe("diferencias (antes/después de la auditoría)", () => {
  it("lista solo los campos que cambiaron", () => {
    const d = diferencias({ precio: 100, nombre: "Corte", activo: true }, { precio: 120, nombre: "Corte", activo: false });
    expect(d).toEqual([
      { campo: "activo", antes: "true", despues: "false" },
      { campo: "precio", antes: "100", despues: "120" },
    ]);
  });
  it("una creación muestra todos los campos nuevos", () => {
    expect(diferencias(null, { estado: "ACTIVA" })).toEqual([{ campo: "estado", antes: "—", despues: "ACTIVA" }]);
  });
  it("una eliminación muestra los campos anteriores", () => {
    expect(diferencias({ clave: "x" }, null)).toEqual([{ campo: "clave", antes: "x", despues: "—" }]);
  });
  it("compara objetos anidados por valor", () => {
    expect(diferencias({ h: { lun: [9, 18] } }, { h: { lun: [9, 18] } })).toEqual([]);
  });
});

describe("esquemaFiltros (lo que llega del navegador)", () => {
  it("acepta filtros válidos y vacíos", () => {
    expect(esquemaFiltros.parse({ entidad: "", accion: "", desde: "", hasta: "", pagina: 1 })).toMatchObject({ pagina: 1 });
    expect(esquemaFiltros.parse({ entidad: "plan_precio", desde: "2026-11-01", hasta: "2026-11-12" }).entidad).toBe("plan_precio");
  });
  it("rechaza entidades con caracteres raros, fechas inválidas y páginas fuera de rango", () => {
    expect(() => esquemaFiltros.parse({ entidad: "pais;drop" })).toThrow();
    expect(() => esquemaFiltros.parse({ desde: "2026-13-45" })).toThrow();
    expect(() => esquemaFiltros.parse({ pagina: 0 })).toThrow();
    expect(() => esquemaFiltros.parse({ accion: "x".repeat(81) })).toThrow();
  });
  it("el rango de fechas es en hora de Colombia e incluye el día final completo", () => {
    expect(rangoFechas("2026-11-12", "2026-11-12")).toEqual({
      p_desde: "2026-11-12T05:00:00.000Z",
      p_hasta: "2026-11-13T05:00:00.000Z",
    });
  });
});
