import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/auth/destino-seguro";

// String.raw evita ambigüedades con la barra invertida (el vector real del ataque).
const BARRA_INVERTIDA = String.raw`/\evil.com`;

describe("destinoSeguro (redirección abierta)", () => {
  it("deja pasar rutas internas", () => {
    expect(destinoSeguro("/mis-reservas")).toBe("/mis-reservas");
    expect(destinoSeguro("/negocio/x/reservar?staff=1")).toBe("/negocio/x/reservar?staff=1");
  });
  it.each(["//evil.com", BARRA_INVERTIDA, "/\t/evil.com", "/\n/evil.com", "https://evil.com", "javascript:alert(1)", "", null, undefined])(
    "rechaza %j",
    (v) => {
      expect(destinoSeguro(v as string)).toBe("/");
    },
  );
  it("no decodifica %5C (se queda como ruta interna)", () => {
    expect(destinoSeguro("/%5Cevil.com")).toBe("/%5Cevil.com");
  });
});
