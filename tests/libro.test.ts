import { describe, expect, it } from "vitest";
import { aCsv, celdaCsv, leerFiltros, rangoFechas, resumenEconomico, type MovimientoLibro, type TotalLibro } from "@/lib/libro/filtros";

describe("libro financiero: filtros", () => {
  it("descarta filtros inválidos en vez de ampliarlos", () => {
    const f = leerFiltros({ categoria: "INVENTADA", estado: "CONFIRMADO" });
    expect(f.categoria).toBeUndefined();
    expect(f.estado).toBeUndefined(); // un campo inválido invalida el lote: vuelve a los valores por defecto
    expect(f.pagina).toBe(1);
  });

  it("rechaza referencias con caracteres de filtro de PostgREST (inyección)", () => {
    const f = leerFiltros({ referencia: "x,negocio_id.eq.otro" });
    expect(f.referencia).toBeUndefined();
    expect(leerFiltros({ referencia: "777001" }).referencia).toBe("777001");
  });

  it("acepta un filtro válido completo", () => {
    const f = leerFiltros({ desde: "2026-11-01", hasta: "2026-11-30", categoria: "ANTICIPO", estado: "CONFIRMADO", pagina: "3" });
    expect(f).toMatchObject({ desde: "2026-11-01", hasta: "2026-11-30", categoria: "ANTICIPO", estado: "CONFIRMADO", pagina: 3 });
  });

  it("el rango incluye el día final completo en hora de Colombia", () => {
    const r = rangoFechas({ desde: "2026-11-01", hasta: "2026-11-01" });
    expect(r.desde).toBe("2026-11-01T05:00:00.000Z");
    expect(r.hasta).toBe("2026-11-02T05:00:00.000Z");
  });
});

describe("libro financiero: CSV", () => {
  it("neutraliza inyección de fórmulas y escapa comillas", () => {
    expect(celdaCsv("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celdaCsv("+57")).toBe(`"'+57"`);
    expect(celdaCsv("@cmd")).toBe(`"'@cmd"`);
    expect(celdaCsv("texto, con coma")).toBe(`"texto, con coma"`);
    expect(celdaCsv(-1000)).toBe("-1000"); // los números negativos no son fórmulas
    expect(celdaCsv(null)).toBe("");
  });

  it("genera cabecera, BOM y una fila por movimiento", () => {
    const m = {
      id: "1",
      entidad: "NEGOCIO",
      negocio_id: "n",
      categoria: "ANTICIPO",
      evento: "PAGO_CONFIRMADO",
      sentido: "INGRESO",
      estado: "CONFIRMADO",
      monto: 10000,
      moneda: "COP",
      ocurrido_at: "2026-11-12T10:00:00Z",
      registrado_at: "2026-11-12T10:00:00Z",
      referencia_tipo: "pago",
      referencia_id: "p",
      pago_id: "p",
      reembolso_id: null,
      reserva_id: "r",
      proveedor: "MERCADOPAGO",
      id_externo: "777",
      cuenta_recaudo: "NEGOCIO",
      actor_tipo: "SISTEMA",
      ajusta_movimiento_id: null,
      motivo: null,
    } satisfies MovimientoLibro;
    const csv = aCsv([m]);
    expect(csv.startsWith("﻿Fecha,")).toBe(true);
    expect(csv.trim().split("\r\n")).toHaveLength(2);
    expect(csv).toContain("10000");
  });
});

describe("libro financiero: resumen", () => {
  it("solo suma hechos confirmados con efecto económico (no es un saldo)", () => {
    const t = (sentido: TotalLibro["sentido"], estado: TotalLibro["estado"], total: number): TotalLibro => ({
      periodo: "2026-11-01",
      entidad: "NEGOCIO",
      categoria: "ANTICIPO",
      sentido,
      estado,
      moneda: "COP",
      cantidad: 1,
      total,
    });
    const r = resumenEconomico([
      t("INGRESO", "CONFIRMADO", 10000),
      t("EGRESO", "CONFIRMADO", 4000),
      t("INFORMATIVO", "PENDIENTE", 99999),
      t("INGRESO", "FALLIDO", 50000),
    ]);
    expect(r).toEqual([{ moneda: "COP", ingresos: 10000, egresos: 4000, neto: 6000 }]);
  });
});
