import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MAGIA = "SNBK1";
const IV_BYTES = 12;
const ETIQUETA_BYTES = 16;

function claveComoBuffer(clave) {
  if (Buffer.byteLength(clave) < 16) throw new Error("CLAVE_BACKUP_DEBIL");
  return createHash("sha256").update(clave).digest();
}

export function cifrarTexto(texto, clave) {
  const iv = randomBytes(IV_BYTES);
  const cifrador = createCipheriv("aes-256-gcm", claveComoBuffer(clave), iv);
  const comprimido = gzipSync(Buffer.from(texto, "utf8"));
  const datos = Buffer.concat([cifrador.update(comprimido), cifrador.final()]);
  return Buffer.concat([
    Buffer.from(MAGIA, "ascii"),
    iv,
    cifrador.getAuthTag(),
    datos,
  ]);
}

export function descifrarTexto(cifrado, clave) {
  const minimo = MAGIA.length + IV_BYTES + ETIQUETA_BYTES;
  if (cifrado.length < minimo || cifrado.subarray(0, MAGIA.length).toString("ascii") !== MAGIA) {
    throw new Error("BACKUP_INVALIDO");
  }
  const iv = cifrado.subarray(MAGIA.length, MAGIA.length + IV_BYTES);
  const etiqueta = cifrado.subarray(MAGIA.length + IV_BYTES, minimo);
  const datos = cifrado.subarray(minimo);
  const descifrador = createDecipheriv("aes-256-gcm", claveComoBuffer(clave), iv);
  descifrador.setAuthTag(etiqueta);
  const comprimido = Buffer.concat([descifrador.update(datos), descifrador.final()]);
  return gunzipSync(comprimido).toString("utf8");
}

export function descifrarArchivo(archivo, clave) {
  return descifrarTexto(readFileSync(archivo), clave);
}

export function prepararDumpDatos(datos) {
  if (datos.includes("SET session_replication_role = 'replica';")) return datos;
  const indice = datos.search(/^COPY /m);
  if (indice < 0) return datos;
  return `${datos.slice(0, indice)}SET session_replication_role = 'replica';\n${datos.slice(indice).trimEnd()}\nRESET session_replication_role;\n`;
}

export function verificarIntegridad(archivo, manifiesto) {
  const bytes = statSync(archivo).size;
  const sha256 = createHash("sha256").update(readFileSync(archivo)).digest("hex");
  if (bytes !== manifiesto.bytes || sha256 !== manifiesto.sha256) {
    throw new Error("MANIFIESTO_INVALIDO");
  }
  return true;
}

export function leerVariable(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  const archivo = ".env.local";
  if (!existsSync(archivo)) return undefined;
  const linea = readFileSync(archivo, "utf8")
    .split(/\r?\n/)
    .find((valor) => valor.startsWith(`${nombre}=`));
  if (!linea) return undefined;
  return linea.slice(nombre.length + 1).trim().replace(/^"|"$/g, "");
}

function ejecutarComando(comando, argumentos) {
  const resultado = spawnSync(comando, argumentos, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) throw new Error(`COMANDO_FALLO: ${comando}`);
  return resultado.stdout ?? "";
}

function rutaNpx() {
  return path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
}

function ejecutarSupabase(args) {
  return ejecutarComando(process.execPath, [rutaNpx(), "supabase", ...args]);
}

function extraerJson(salida) {
  const coincidencia = salida.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!coincidencia) throw new Error(`SALIDA_JSON_INVALIDA: ${salida.slice(0, 300)}`);
  return JSON.parse(coincidencia[0]);
}

async function consultarConteos(dbUrl) {
  const sql = "select (select count(*) from supabase_migrations.schema_migrations) as migraciones, (select count(*) from auth.users) as usuarios, (select count(*) from public.texto_legal) as textos_legales, (select coalesce(max(version), '0') from supabase_migrations.schema_migrations) as ultima_migracion";
  const filas = extraerJson(ejecutarSupabase(["db", "query", "--db-url", dbUrl, "--output", "json", sql]));
  return filas[0];
}

async function main() {
  const directorio = path.resolve(process.argv[2] ?? "supabase/.temp/backups");
  const clave = leerVariable("BACKUP_CIFRADO_CLAVE");
  const dbUrl = leerVariable("DATABASE_URL");
  if (!clave) throw new Error("Falta BACKUP_CIFRADO_CLAVE");
  if (!dbUrl) throw new Error("Falta DATABASE_URL");
  mkdirSync(directorio, { recursive: true });
  const temporal = mkdtempSync(path.join(tmpdir(), "stylernow-dump-"));
  try {
    const esquema = path.join(temporal, "esquema.sql");
    const datos = path.join(temporal, "datos.sql");
    const argumentos = ["db", "dump", "--db-url", dbUrl, "--schema", "public,auth,storage,supabase_migrations"];
    ejecutarSupabase([...argumentos, "--file", esquema]);
    ejecutarSupabase([...argumentos, "--data-only", "--use-copy", "--file", datos]);
    const dumpCompleto = `${readFileSync(esquema, "utf8")}\n${prepararDumpDatos(readFileSync(datos, "utf8"))}`;
    const conteos = await consultarConteos(dbUrl);
    const cifrado = cifrarTexto(dumpCompleto, clave);
    const sello = new Date().toISOString().replace(/[:.]/g, "-");
    const archivo = path.join(directorio, `backup-${sello}.sql.enc`);
    writeFileSync(archivo, cifrado);
    const manifiesto = {
      creado_en: new Date().toISOString(),
      archivo: path.basename(archivo),
      bytes: cifrado.length,
      sha256: createHash("sha256").update(cifrado).digest("hex"),
      conteos,
    };
    writeFileSync(`${archivo}.json`, `${JSON.stringify(manifiesto, null, 2)}\n`);
    console.log(`OK: ${archivo}`);
    console.log(`OK: ${archivo}.json`);
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
