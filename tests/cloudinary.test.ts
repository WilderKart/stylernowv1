import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { configCloudinary, firmaDeEntrega, firmarParametros, subirImagenCloudinary, urlFirmada } from "@/lib/almacenamiento/cloudinary";

const CFG = { cloudName: "demo", apiKey: "123", apiSecret: "abcd" };

describe("adaptador Cloudinary (sin red)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("firma la subida como la documenta Cloudinary (vector público)", () => {
    // Ejemplo de la guía «Authentication signatures» de Cloudinary.
    const firma = firmarParametros(
      { eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 },
      "abcd"
    );
    expect(firma).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("excluye file, api_key, resource_type y cloud_name de la firma y ordena las claves", () => {
    const a = firmarParametros({ timestamp: 1, folder: "x", api_key: "k", file: "f", resource_type: "image" }, "s");
    expect(a).toBe(createHash("sha1").update("folder=x&timestamp=1s").digest("hex"));
  });

  it("firma de entrega: 8 caracteres base64 URL-safe entre s-- y --", () => {
    const f = firmaDeEntrega("v1/carpeta/foto.jpg", "abcd");
    expect(f).toMatch(/^s--[A-Za-z0-9_-]{8}--$/);
    const url = urlFirmada("carpeta/foto", { version: 1, formato: "jpg", config: CFG });
    expect(url).toBe(`https://res.cloudinary.com/demo/image/authenticated/${f}/v1/carpeta/foto.jpg`);
  });

  it("sin variables de entorno no se activa", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    expect(configCloudinary()).toBeNull();
  });

  it("rechaza tipos y tamaños no permitidos antes de llamar a la red", async () => {
    const fetchEspia = vi.fn();
    vi.stubGlobal("fetch", fetchEspia);
    await expect(
      subirImagenCloudinary({ bytes: Buffer.from("<svg/>"), mime: "image/svg+xml", carpeta: "c", publicId: "p", config: CFG })
    ).rejects.toThrow("TIPO_NO_PERMITIDO");
    await expect(
      subirImagenCloudinary({ bytes: Buffer.alloc(11), mime: "image/png", carpeta: "c", publicId: "p", maxBytes: 10, config: CFG })
    ).rejects.toThrow("ARCHIVO_DEMASIADO_GRANDE");
    expect(fetchEspia).not.toHaveBeenCalled();
  });

  it("envía la subida firmada y devuelve URL firmada para privados; nunca envía la clave secreta", async () => {
    let cuerpo: FormData | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: FormData }) => {
        cuerpo = init.body;
        return new Response(JSON.stringify({ public_id: "c/p", version: 7, format: "png", bytes: 3 }), { status: 200 });
      })
    );
    const r = await subirImagenCloudinary({ bytes: Buffer.from("abc"), mime: "image/png", carpeta: "c", publicId: "p", tipo: "authenticated", config: CFG });
    expect(r.url).toBe(urlFirmada("c/p", { version: 7, formato: "png", config: CFG }));
    const enviados = [...(cuerpo as unknown as FormData).entries()].map(([, v]) => String(v)).join("|");
    expect(enviados).not.toContain("abcd");
    expect((cuerpo as unknown as FormData).get("type")).toBe("authenticated");
  });

  it("si Cloudinary responde error, lanza un código genérico", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "x" } }), { status: 401 })));
    await expect(
      subirImagenCloudinary({ bytes: Buffer.from("a"), mime: "image/jpeg", carpeta: "c", publicId: "p", config: CFG })
    ).rejects.toThrow("CLOUDINARY_SUBIDA_FALLIDA");
  });
});
