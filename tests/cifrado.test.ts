import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("cifrado de credenciales de pago (AES-256-GCM)", () => {
  beforeAll(() => {
    process.env.PAGOS_CIFRADO_CLAVE = randomBytes(32).toString("base64");
  });

  it("cifra y descifra sin perder el contenido", async () => {
    const { cifrar, descifrar } = await import("@/lib/pagos/cifrado");
    const token = "APP_USR-1234567890-abcdef";
    const c = cifrar(token);
    expect(c.startsWith("v1.")).toBe(true);
    expect(c).not.toContain(token);
    expect(descifrar(c)).toBe(token);
  });

  it("dos cifrados del mismo texto son distintos (IV aleatorio)", async () => {
    const { cifrar } = await import("@/lib/pagos/cifrado");
    expect(cifrar("x")).not.toBe(cifrar("x"));
  });

  it("rechaza un cifrado alterado", async () => {
    const { cifrar, descifrar } = await import("@/lib/pagos/cifrado");
    const partes = cifrar("secreto").split(".");
    const datos = Buffer.from(partes[3], "base64url");
    datos[0] ^= 0xff;
    partes[3] = datos.toString("base64url");
    expect(() => descifrar(partes.join("."))).toThrow();
  });

  it("rechaza formatos desconocidos y claves inválidas", async () => {
    const { cifrar, descifrar } = await import("@/lib/pagos/cifrado");
    expect(() => descifrar("v0.a.b.c")).toThrow("PAGOS_CIFRADO_FORMATO_INVALIDO");
    const original = process.env.PAGOS_CIFRADO_CLAVE;
    process.env.PAGOS_CIFRADO_CLAVE = Buffer.from("corta").toString("base64");
    expect(() => cifrar("x")).toThrow("PAGOS_CIFRADO_CLAVE_INVALIDA");
    process.env.PAGOS_CIFRADO_CLAVE = original;
  });
});
