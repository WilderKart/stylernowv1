import { describe, expect, it } from "vitest";
import { terminologiaDe } from "@/lib/terminologia";

describe("terminologiaDe", () => {
  it("nombra al profesional según el tipo de negocio", () => {
    expect(terminologiaDe(["barberia"]).Profesionales).toBe("Barberos");
    expect(terminologiaDe(["spa"]).profesional).toBe("masajista");
    expect(terminologiaDe(["masajes"]).Profesional).toBe("Masajista");
    expect(terminologiaDe(["manicura"]).Profesionales).toBe("Manicuristas");
    expect(terminologiaDe(["tatuajes"]).profesionales).toBe("tatuadores");
    expect(terminologiaDe(["salon"]).Profesional).toBe("Estilista");
  });
  it("manda la primera categoría y tolera mayúsculas", () => {
    expect(terminologiaDe([" SPA ", "barberia"]).profesional).toBe("masajista");
  });
  it("sin categoría o desconocida usa «profesional»", () => {
    expect(terminologiaDe(null).profesional).toBe("profesional");
    expect(terminologiaDe([]).Profesionales).toBe("Profesionales");
    expect(terminologiaDe(["otra"]).profesional).toBe("profesional");
  });
});
