import { describe, expect, it } from "vitest";
import { telefonoE164 } from "@/lib/telefono-registro";

describe("celular del registro", () => {
  it("Colombia: solo celulares 3XX de 10 dígitos", () => {
    expect(telefonoE164("CO", "300 123 4567")).toBe("+573001234567");
    expect(telefonoE164("CO", "+57 300-123-4567")).toBe("+573001234567");
    expect(telefonoE164("CO", "6012345678")).toBeNull(); // fijo de Bogotá
    expect(telefonoE164("CO", "30012345")).toBeNull();
  });

  it("Estados Unidos, México y España", () => {
    expect(telefonoE164("US", "(201) 555-0123")).toBe("+12015550123");
    expect(telefonoE164("US", "1 201 555 0123")).toBe("+12015550123");
    expect(telefonoE164("US", "101 555 0123")).toBeNull();
    expect(telefonoE164("MX", "55 1234 5678")).toBe("+525512345678");
    expect(telefonoE164("ES", "612 345 678")).toBe("+34612345678");
    expect(telefonoE164("ES", "912 345 678")).toBeNull(); // fijo
  });

  it("rechaza texto o inyecciones", () => {
    expect(telefonoE164("CO", "'; drop table perfil; --")).toBeNull();
    expect(telefonoE164("CO", "")).toBeNull();
  });
});
