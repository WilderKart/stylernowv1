import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { adaptadorSms } from "@/lib/cumplimiento/adaptador-sms";
import { MAX_BYTES, nombreSeguro, rutaAdjunto, validarArchivo } from "@/lib/cumplimiento/archivos";
import { renderizar, restanteLegible } from "@/lib/cumplimiento/notificaciones";
import { generarToken, hashToken, normalizarNumero, TOKEN_RE } from "@/lib/cumplimiento/seguimiento";

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

describe("seguimiento: token y número", () => {
  it("el token tiene 256 bits y solo se guarda su SHA-256", () => {
    const { token, hash } = generarToken();
    expect(token).toMatch(TOKEN_RE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });
  it("dos tokens nunca coinciden", () => {
    const s = new Set(Array.from({ length: 200 }, () => generarToken().token));
    expect(s.size).toBe(200);
  });
  it("normaliza y valida el número de radicación", () => {
    expect(normalizarNumero(" sn-2026-000123 ")).toBe("SN-2026-000123");
    expect(normalizarNumero("SN-2026-12")).toBeNull();
    expect(normalizarNumero("'; drop table ticket_soporte;--")).toBeNull();
    expect(normalizarNumero(null)).toBeNull();
  });
  it("un token mal formado no pasa la validación", () => {
    expect(TOKEN_RE.test("corto")).toBe(false);
    expect(TOKEN_RE.test("a".repeat(44))).toBe(false);
    expect(TOKEN_RE.test("a".repeat(42) + "!")).toBe(false);
  });
});

describe("archivos: se decide por la firma binaria, no por lo que declara el navegador", () => {
  it("acepta PDF, PNG y JPEG reales", () => {
    expect(validarArchivo("a.pdf", PDF)).toMatchObject({ ok: true, archivo: { mime: "application/pdf", ext: "pdf" } });
    expect(validarArchivo("a.png", PNG)).toMatchObject({ ok: true, archivo: { mime: "image/png", ext: "png" } });
    expect(validarArchivo("a.jpg", JPG)).toMatchObject({ ok: true, archivo: { mime: "image/jpeg", ext: "jpg" } });
  });
  it("rechaza ejecutables, HTML y SVG aunque se llamen .pdf", () => {
    for (const cuerpo of ["MZ\x90\x00 programa", "<html><script>alert(1)</script></html>", "<svg onload=alert(1)/>", "#!/bin/sh\nrm -rf /"]) {
      expect(validarArchivo("factura.pdf", new TextEncoder().encode(cuerpo))).toMatchObject({ ok: false });
    }
  });
  it("rechaza un PDF con contenido activo", () => {
    for (const activo of ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/OpenAction"]) {
      const b = new TextEncoder().encode(`%PDF-1.4\n<< ${activo} (app.alert(1)) >>`);
      expect(validarArchivo("x.pdf", b)).toMatchObject({ ok: false });
    }
  });
  it("rechaza vacío y demasiado grande", () => {
    expect(validarArchivo("x.pdf", new Uint8Array())).toMatchObject({ ok: false });
    const grande = new Uint8Array(MAX_BYTES + 1);
    grande.set(PNG);
    expect(validarArchivo("x.png", grande)).toMatchObject({ ok: false });
  });
  it("sanea el nombre y la ruta no usa nada del usuario", () => {
    expect(nombreSeguro("../../etc/pass wd<script>.pdf")).not.toMatch(/[\/\\<>]/);
    expect(nombreSeguro("")).toBe("archivo");
    const r = rutaAdjunto("11111111-1111-1111-1111-111111111111", "pdf");
    expect(r).toMatch(/^11111111-1111-1111-1111-111111111111\/[0-9a-f-]{36}\.pdf$/);
  });
  it("calcula el SHA-256 del contenido", () => {
    const v = validarArchivo("a.png", PNG);
    expect(v.ok && v.archivo.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("SMS: preparado pero DESHABILITADO mientras no haya proveedor", () => {
  it("sin proveedor no está habilitado y nunca devuelve ok", async () => {
    const a = adaptadorSms({ habilitado: false, proveedor: null, credencialesRef: null }, {});
    expect(a.habilitado).toBe(false);
    expect(await a.enviar("+57 3000000000", "hola", "k")).toEqual({ ok: false, codigo: "CANAL_NO_HABILITADO", reintentable: false });
  });
  it("aunque la configuración diga «habilitado», sin proveedor registrado ni credenciales sigue apagado", async () => {
    const a = adaptadorSms({ habilitado: true, proveedor: "TWILIO", credencialesRef: "SMS_KEY" }, { SMS_KEY: "secreto" });
    expect(a.habilitado).toBe(false);
    expect(await a.enviar("+57 3000000000", "hola", "k")).toMatchObject({ ok: false, codigo: "CANAL_NO_HABILITADO" });
  });
});

describe("plantillas", () => {
  it("reemplaza variables y escapa HTML en el correo", () => {
    expect(renderizar("Caso {{numero}} · {{prioridad}}", { numero: "SN-2026-000001", prioridad: "CRITICA" })).toBe("Caso SN-2026-000001 · CRITICA");
    expect(renderizar("Hola {{x}}", { x: "<script>alert(1)</script>" }, true)).toBe("Hola &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(renderizar("{{falta}}", {})).toBe("");
  });
  it("describe el tiempo restante", () => {
    expect(restanteLegible(null)).toBe("sin plazo");
    expect(restanteLegible(-5)).toBe("vencido hace 5 h");
    expect(restanteLegible(10)).toBe("10 h");
    expect(restanteLegible(96)).toBe("4 días");
  });
});

import { paisEstaHabilitado, paisesHabilitados } from "@/lib/planes/paises-habilitados";

describe("solo Colombia en el lanzamiento", () => {
  it("por defecto solo CO está habilitado", () => {
    expect(paisesHabilitados("")).toEqual(["CO"]);
    expect(paisesHabilitados(undefined)).toEqual(["CO"]);
    expect(paisEstaHabilitado("US", "")).toBe(false);
    expect(paisEstaHabilitado("co", "")).toBe(true);
  });
  it("abrir un mercado es configuración, no código", () => {
    expect(paisesHabilitados("CO, mx")).toEqual(["CO", "MX"]);
    expect(paisesHabilitados("basura,;;")).toEqual(["CO"]);
  });
});
