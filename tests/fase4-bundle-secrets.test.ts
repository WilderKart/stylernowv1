import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buscarSecretosEnBundle } from "../tools/check-bundle-secrets.mjs";

type Hallazgo = { archivo: string; patron: string; linea: number };

const temporales: string[] = [];

const crearDirectorio = () => {
  const ruta = mkdtempSync(path.join(tmpdir(), "stylernow-bundle-"));
  temporales.push(ruta);
  return ruta;
};

afterEach(() => {
  while (temporales.length > 0) {
    rmSync(temporales.pop()!, { recursive: true, force: true });
  }
});

describe("Fase 4 · secreto en bundle", () => {
  it("detecta service_role y SUPABASE_SECRET_KEY en .next/static", () => {
    const raiz = crearDirectorio();
    mkdirSync(path.join(raiz, "chunks"), { recursive: true });
    writeFileSync(path.join(raiz, "chunks", "app.js"), "const a='service_role';const b='SUPABASE_SECRET_KEY';");

    const hallazgos: Hallazgo[] = buscarSecretosEnBundle(raiz);

    expect(hallazgos.map((h) => h.patron)).toEqual(["service_role", "SUPABASE_SECRET_KEY"]);
    expect(hallazgos[0].archivo).toContain("app.js");
  });

  it("ignora texto seguro y archivos que no son JavaScript", () => {
    const raiz = crearDirectorio();
    writeFileSync(path.join(raiz, "safe.js"), "export const appName = 'stylernow';");
    writeFileSync(path.join(raiz, "nota.txt"), "service_role SUPABASE_SECRET_KEY");

    expect(buscarSecretosEnBundle(raiz)).toEqual([]);
  });
});
