import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/password-history", () => ({
  passwordFueUsadaAntes: vi.fn(),
  guardarEnHistorial: vi.fn(),
}));

import { passwordFueUsadaAntes } from "@/lib/auth/password-history";
import { validarFormatoPassword } from "@/lib/auth/password";
import { POLITICA_PASSWORD, validarPolitica } from "@/lib/auth/password-policy";
import { validarContrasenaNueva } from "@/lib/auth/password-validator";

const CLAVE_VALIDA = "Abcdef1!";
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(passwordFueUsadaAntes).mockReset();
  vi.mocked(passwordFueUsadaAntes).mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Fase 7 · formato de contraseña", () => {
  it("acepta el límite mínimo y rechaza cada regla con su mensaje exacto", () => {
    expect(POLITICA_PASSWORD).toEqual({
      minimo: 8,
      requiereMayuscula: true,
      requiereMinuscula: true,
      requiereNumero: true,
      requiereSimbolo: true,
      noReutilizarUltimas: 5,
    });
    expect(validarFormatoPassword(CLAVE_VALIDA)).toEqual({ ok: true });
    expect(validarFormatoPassword("Ab1!")).toEqual({ ok: false, error: "Mínimo 8 caracteres" });
    expect(validarFormatoPassword("abcdefg1!")).toEqual({ ok: false, error: "Necesita al menos una mayúscula" });
    expect(validarFormatoPassword("ABCDEFG1!")).toEqual({ ok: false, error: "Necesita al menos una minúscula" });
    expect(validarFormatoPassword("Abcdefgh!")).toEqual({ ok: false, error: "Necesita al menos un número" });
    expect(validarFormatoPassword("Abcdefg1")).toEqual({ ok: false, error: "Necesita al menos un símbolo" });
  });
});

describe("Fase 7 · política de contraseñas filtradas", () => {
  it("envía solo los 5 primeros caracteres del SHA-1 y pide relleno", async () => {
    const sha1 = createHash("sha1").update(CLAVE_VALIDA).digest("hex").toUpperCase();
    await expect(validarPolitica(CLAVE_VALIDA)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`);
    expect(init.headers).toEqual({ "Add-Padding": "true" });
  });

  it("rechaza una contraseña presente en la respuesta de HIBP", async () => {
    const sha1 = createHash("sha1").update(CLAVE_VALIDA).digest("hex").toUpperCase();
    fetchMock.mockResolvedValueOnce(new Response(`OTRO:1\n${sha1.slice(5)}:42\nFIN:3`, { status: 200 }));
    await expect(validarPolitica(CLAVE_VALIDA)).resolves.toEqual({
      ok: false,
      error: "Esta contraseña apareció en filtraciones públicas — elige otra.",
    });
  });

  it("acepta espacios alrededor del sufijo devuelto por HIBP", async () => {
    const sha1 = createHash("sha1").update(CLAVE_VALIDA).digest("hex").toUpperCase();
    fetchMock.mockResolvedValueOnce(new Response(`  ${sha1.slice(5)}  :1`, { status: 200 }));
    await expect(validarPolitica(CLAVE_VALIDA)).resolves.toEqual({
      ok: false,
      error: "Esta contraseña apareció en filtraciones públicas — elige otra.",
    });
  });

  it("falla abierto si HIBP responde error, lanza o no hay red", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    await expect(validarPolitica(CLAVE_VALIDA)).resolves.toEqual({ ok: true });

    fetchMock.mockRejectedValueOnce(new Error("sin red"));
    await expect(validarPolitica(CLAVE_VALIDA)).resolves.toEqual({ ok: true });
  });

  it("no consulta HIBP cuando el formato ya es inválido", async () => {
    await expect(validarPolitica("corta")).resolves.toEqual({ ok: false, error: "Mínimo 8 caracteres" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Fase 7 · validador único de contraseña nueva", () => {
  it("acepta una contraseña válida y nunca reutilizada", async () => {
    await expect(validarContrasenaNueva("user-1", CLAVE_VALIDA)).resolves.toEqual({ ok: true });
    expect(passwordFueUsadaAntes).toHaveBeenCalledWith("user-1", CLAVE_VALIDA);
  });

  it("no consulta el historial cuando la política falla", async () => {
    await expect(validarContrasenaNueva("user-1", "corta")).resolves.toEqual({ ok: false, error: "Mínimo 8 caracteres" });
    expect(passwordFueUsadaAntes).not.toHaveBeenCalled();
  });

  it("rechaza reutilizar alguna de las últimas 5 contraseñas", async () => {
    vi.mocked(passwordFueUsadaAntes).mockResolvedValueOnce(true);
    await expect(validarContrasenaNueva("user-1", CLAVE_VALIDA)).resolves.toEqual({
      ok: false,
      error: "No puedes reutilizar ninguna de tus últimas 5 contraseñas.",
    });
  });
});
