import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cifrarTexto, descifrarTexto, prepararDumpDatos, verificarIntegridad } from "../tools/backup-supabase.mjs";

type ManifiestoBackup = {
  creado_en: string;
  archivo: string;
  bytes: number;
  sha256: string;
  conteos: { migraciones: number; usuarios: number; textos_legales: number; ultima_migracion: string };
};

const temporales: string[] = [];
const CLAVE = "clave-de-prueba-fase4-1234567890";

const crearDirectorio = () => {
  const ruta = mkdtempSync(path.join(tmpdir(), "stylernow-backup-"));
  temporales.push(ruta);
  return ruta;
};

afterEach(() => {
  while (temporales.length > 0) {
    rmSync(temporales.pop()!, { recursive: true, force: true });
  }
});

describe("Fase 4 · backup cifrado", () => {
  it("cifra y descifra el dump con AES-256-GCM", () => {
    const cifrado = cifrarTexto("CREATE TABLE demo (id int);", CLAVE);
    const texto = descifrarTexto(cifrado, CLAVE);

    expect(cifrado.subarray(0, 5).toString()).toBe("SNBK1");
    expect(texto).toBe("CREATE TABLE demo (id int);");
  });

  it("rechaza un archivo manipulado", () => {
    const cifrado = cifrarTexto("CREATE TABLE demo (id int);", CLAVE);
    cifrado[cifrado.length - 1] ^= 1;

    expect(() => descifrarTexto(cifrado, CLAVE)).toThrow();
  });

  it("desactiva los triggers durante la carga de datos con FK circulares", () => {
    const datos = "-- cabecera\nSET statement_timeout = 0;\nCOPY public.whatsapp_conversacion_lote (id) FROM stdin;\n1\n\\.\n";
    const preparado = prepararDumpDatos(datos);

    expect(preparado).toContain("SET session_replication_role = 'replica';\nCOPY public.whatsapp_conversacion_lote");
    expect(preparado.trimEnd()).toMatch(/RESET session_replication_role;$/);
    expect(prepararDumpDatos(preparado)).toBe(preparado);
  });

  it("comprueba el sha256 del manifiesto", () => {
    const directorio = crearDirectorio();
    const archivo = path.join(directorio, "backup.sql.enc");
    writeFileSync(archivo, "respaldo");
    const manifiesto: ManifiestoBackup = {
      creado_en: "2026-11-22T00:00:00.000Z",
      archivo: "backup.sql.enc",
      bytes: 8,
      sha256: "07c4a3a895eb90fb7c01ba288e856ac28e311a3533fcd72cb10a0a2b5dd66963",
      conteos: { migraciones: 182, usuarios: 284, textos_legales: 9, ultima_migracion: "182" },
    };

    expect(verificarIntegridad(archivo, manifiesto)).toBe(true);
    expect(() =>
      verificarIntegridad(archivo, { ...manifiesto, bytes: 9 }),
    ).toThrow("MANIFIESTO_INVALIDO");
  });
});
