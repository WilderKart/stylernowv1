import { createECDH } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

function parValido() {
  const e = createECDH("prime256v1");
  e.generateKeys();
  return { publica: e.getPublicKey().toString("base64url"), privada: e.getPrivateKey().toString("base64url") };
}

async function cargar() {
  vi.resetModules();
  return import("@/lib/notificaciones/claves-vapid");
}

const ENTORNO = { ...process.env };
beforeEach(() => {
  rpc.mockReset();
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});
afterEach(() => {
  process.env = { ...ENTORNO };
});

describe("claves VAPID del servidor", () => {
  it("las variables de entorno completas mandan y no se toca la base", async () => {
    const par = parValido();
    process.env.VAPID_PUBLIC_KEY = par.publica;
    process.env.VAPID_PRIVATE_KEY = par.privada;
    process.env.VAPID_SUBJECT = "mailto:equipo@stylernow.com";
    const { obtenerClavesVapid } = await cargar();
    const claves = await obtenerClavesVapid();
    expect(claves?.publicaB64).toBe(par.publica);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin entorno, lee el par guardado en Vault", async () => {
    const par = parValido();
    rpc.mockResolvedValueOnce({ data: [{ publica: par.publica, privada: par.privada }], error: null });
    const { obtenerClavesVapid, vapidPublica } = await cargar();
    expect((await obtenerClavesVapid())?.publicaB64).toBe(par.publica);
    // La segunda lectura sale de la memoria: no vuelve a consultar la base.
    expect(await vapidPublica()).toBe(par.publica);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("push_vapid_leer");
  });

  it("si Vault está vacío genera el par UNA vez, lo guarda y usa el que quedó guardado", async () => {
    const guardado = parValido();
    rpc
      .mockResolvedValueOnce({ data: [{ publica: null, privada: null }], error: null }) // leer: vacío
      .mockResolvedValueOnce({ data: true, error: null }) // guardar
      .mockResolvedValueOnce({ data: [{ publica: guardado.publica, privada: guardado.privada }], error: null }); // releer
    const { obtenerClavesVapid } = await cargar();
    const claves = await obtenerClavesVapid();
    expect(claves?.publicaB64).toBe(guardado.publica);
    const llamadaGuardar = rpc.mock.calls[1];
    expect(llamadaGuardar[0]).toBe("push_vapid_guardar");
    expect(llamadaGuardar[1].p_publica).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(llamadaGuardar[1].p_privada).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("si la base rechaza guardar, no hay claves (el canal queda apagado, nunca simulado)", async () => {
    rpc.mockResolvedValueOnce({ data: [{ publica: null, privada: null }], error: null }).mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const { obtenerClavesVapid } = await cargar();
    expect(await obtenerClavesVapid()).toBeNull();
  });

  it("un par incoherente en Vault no se usa", async () => {
    const a = parValido();
    const b = parValido();
    rpc.mockResolvedValueOnce({ data: [{ publica: a.publica, privada: b.privada }], error: null });
    const { obtenerClavesVapid } = await cargar();
    expect(await obtenerClavesVapid()).toBeNull();
  });

  it("entornoConVapid agrega las claves sin perder el resto del entorno", async () => {
    const par = parValido();
    rpc.mockResolvedValueOnce({ data: [{ publica: par.publica, privada: par.privada }], error: null });
    const { entornoConVapid } = await cargar();
    const env = await entornoConVapid();
    expect(env.VAPID_PUBLIC_KEY).toBe(par.publica);
    expect(env.VAPID_PRIVATE_KEY).toBe(par.privada);
    expect(env.VAPID_SUBJECT).toMatch(/^mailto:/);
  });
});
