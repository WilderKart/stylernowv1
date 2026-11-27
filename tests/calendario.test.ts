import { describe, expect, it } from "vitest";
import { domingoDePascua, festivoDe, festivosColombia } from "@/lib/calendario/festivos-colombia";
import { diasDelMes, semanasDelMes, sumarMeses } from "@/lib/calendario/mes";

const lista = (a: number) => [...festivosColombia(a).keys()].sort();

describe("festivos de Colombia", () => {
  it("Pascua", () => {
    expect(domingoDePascua(2024)).toBe("2024-03-31");
    expect(domingoDePascua(2025)).toBe("2025-04-20");
    expect(domingoDePascua(2026)).toBe("2026-04-05");
    expect(domingoDePascua(2027)).toBe("2027-03-28");
  });
  it("2026 (18 festivos, con traslados a lunes)", () => {
    expect(lista(2026)).toEqual([
      "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15",
      "2026-06-29", "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    ]);
  });
  it("2025", () => {
    expect(lista(2025)).toEqual([
      "2025-01-01", "2025-01-06", "2025-03-24", "2025-04-17", "2025-04-18", "2025-05-01", "2025-06-02", "2025-06-23", "2025-06-30",
      "2025-07-20", "2025-08-07", "2025-08-18", "2025-10-13", "2025-11-03", "2025-11-17", "2025-12-08", "2025-12-25",
    ]);
  });
  it("año bisiesto 2024 y fechas sueltas", () => {
    expect(festivoDe("2024-03-25")).toBe("Día de San José"); // 19 mar (martes) → lunes 25
    expect(festivoDe("2024-03-28")).toBe("Jueves Santo");
    expect(festivoDe("2026-09-08")).toBeNull();
    expect(festivoDe("2026-07-20")).toBe("Día de la Independencia");
  });
  it("todos los festivos trasladables caen en lunes y siempre hay 18", () => {
    for (const a of [2024, 2025, 2026, 2027, 2028, 2030, 2035]) {
      for (const [f, n] of festivosColombia(a)) {
        if (/Reyes|San José|San Pedro|Asunción|Raza|Todos los Santos|Cartagena|Ascensión|Corpus|Sagrado/.test(n)) {
          const [y, m, d] = f.split("-").map(Number);
          expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1);
        }
      }
      expect(festivosColombia(a).size).toBeGreaterThanOrEqual(17); // 18, salvo que dos coincidan en la misma fecha
    }
  });
});

describe("mes", () => {
  it("días del mes y bisiestos", () => {
    expect(diasDelMes("2026-02")).toBe(28);
    expect(diasDelMes("2024-02")).toBe(29);
    expect(diasDelMes("2100-02")).toBe(28);
    expect(diasDelMes("2000-02")).toBe(29);
    expect(diasDelMes("2026-04")).toBe(30);
    expect(diasDelMes("2026-01")).toBe(31);
  });
  it("sumar meses cruza años", () => {
    expect(sumarMeses("2026-12", 1)).toBe("2027-01");
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
    expect(sumarMeses("2026-01", 13)).toBe("2027-02");
    expect(sumarMeses("2026-03", -15)).toBe("2024-12");
  });
  it("semanas empiezan en lunes y cubren el mes", () => {
    const s = semanasDelMes("2026-09"); // 1 sep 2026 = martes
    expect(s[0][0]).toBe("2026-08-31");
    expect(s[0][1]).toBe("2026-09-01");
    expect(s.every((f) => f.length === 7)).toBe(true);
    expect(s.flat()).toContain("2026-09-30");
    expect(s.length).toBe(5);
    expect(semanasDelMes("2026-02").length).toBe(5); // 1 feb 2026 es domingo (última columna)
    expect(semanasDelMes("2027-02").length).toBe(4); // 1 feb 2027 es lunes y tiene 28 días
    expect(semanasDelMes("2024-02").flat()).toContain("2024-02-29");
  });
});
