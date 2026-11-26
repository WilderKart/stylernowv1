import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const play = vi.fn(() => Promise.resolve());
const vibrate = vi.fn();
let almacen: Map<string, string>;

class AudioFalso {
  preload = "";
  volume = 1;
  muted = false;
  currentTime = 0;
  play = play;
  pause = vi.fn();
  constructor(public src: string) {}
}

async function cargar() {
  vi.resetModules();
  return import("@/lib/soporte/sonido");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
  play.mockClear();
  play.mockImplementation(() => Promise.resolve());
  vibrate.mockClear();
  almacen = new Map();
  vi.stubGlobal("Audio", AudioFalso);
  vi.stubGlobal("localStorage", { getItem: (k: string) => almacen.get(k) ?? null, setItem: (k: string, v: string) => void almacen.set(k, v) });
  vi.stubGlobal("window", { dispatchEvent: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("navigator", { vibrate });
  vi.stubGlobal("document", { hidden: false, title: "Panel", addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("aviso sonoro del chat de soporte", () => {
  it("viene activado y la preferencia se guarda en el dispositivo", async () => {
    const { sonidoActivado, fijarSonido } = await cargar();
    expect(sonidoActivado()).toBe(true);
    fijarSonido(false);
    expect(sonidoActivado()).toBe(false);
    expect(almacen.get("sn_sonido_soporte")).toBe("0");
    fijarSonido(true);
    expect(sonidoActivado()).toBe(true);
  });

  it("suena una vez y agrupa una ráfaga de mensajes", async () => {
    const { reproducirAviso } = await cargar();
    reproducirAviso();
    reproducirAviso();
    reproducirAviso();
    expect(play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3600);
    reproducirAviso();
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("no suena si está silenciado, salvo la vista previa del botón", async () => {
    const { reproducirAviso, fijarSonido } = await cargar();
    fijarSonido(false);
    reproducirAviso();
    expect(play).not.toHaveBeenCalled();
    reproducirAviso(true);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("si el navegador bloquea el audio, no lanza errores", async () => {
    play.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    const { reproducirAviso } = await cargar();
    expect(() => reproducirAviso()).not.toThrow();
    await vi.advanceTimersByTimeAsync(10);
  });

  it("con la pestaña oculta marca el título y vibra", async () => {
    vi.stubGlobal("document", { hidden: true, title: "Panel", addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { reproducirAviso } = await cargar();
    reproducirAviso();
    expect((document as unknown as { title: string }).title).toContain("Nuevo mensaje");
    expect(vibrate).toHaveBeenCalled();
  });
});
