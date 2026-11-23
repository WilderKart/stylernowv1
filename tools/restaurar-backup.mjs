import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { descifrarArchivo, leerVariable, prepararDumpDatos, verificarIntegridad } from "./backup-supabase.mjs";

const CLAVES = ["migraciones", "usuarios", "textos_legales", "ultima_migracion"];

export function compararConteos(obtenidos, esperados) {
  return CLAVES.filter((clave) => String(obtenidos[clave]) !== String(esperados[clave])).map(
    (clave) => `${clave}: esperado ${esperados[clave]}, obtenido ${obtenidos[clave]}`,
  );
}

function docker(args, entrada) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    input: entrada,
    stdio: entrada === undefined ? ["ignore", "pipe", "inherit"] : ["pipe", "pipe", "inherit"],
  }).trim();
}

function contenedorBase() {
  if (process.env.SUPABASE_DB_CONTAINER) return process.env.SUPABASE_DB_CONTAINER;
  const config = readFileSync("supabase/config.toml", "utf8");
  const proyecto = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!proyecto) throw new Error("No se pudo determinar el proyecto Supabase local");
  return `supabase_db_${proyecto}`;
}

function consultarConteos(contenedor, base) {
  const sql = `select
    (select count(*) from supabase_migrations.schema_migrations),
    (select count(*) from auth.users),
    (select count(*) from public.texto_legal),
    (select coalesce(max(version), '0') from supabase_migrations.schema_migrations)`;
  const salida = docker([
    "exec",
    contenedor,
    "psql",
    "-U",
    "supabase_admin",
    "-d",
    base,
    "-At",
    "-F",
    ",",
    "-c",
    sql,
  ]);
  const [migraciones, usuarios, textosLegales, ultimaMigracion] = salida.split(",");
  return {
    migraciones: Number(migraciones),
    usuarios: Number(usuarios),
    textos_legales: Number(textosLegales),
    ultima_migracion: ultimaMigracion,
  };
}

async function main() {
  const archivo = path.resolve(process.argv[2] ?? "");
  if (!process.argv[2]) throw new Error("Uso: node tools/restaurar-backup.mjs <backup.sql.enc>");
  const clave = leerVariable("BACKUP_CIFRADO_CLAVE");
  if (!clave) throw new Error("Falta BACKUP_CIFRADO_CLAVE");
  const manifiesto = JSON.parse(readFileSync(`${archivo}.json`, "utf8"));
  verificarIntegridad(archivo, manifiesto);

  const contenedor = contenedorBase();
  const base = "stylernow_restore_drill";
  const temporal = mkdtempSync(path.join(tmpdir(), "stylernow-restore-"));
  const inicio = performance.now();
  try {
    const dump = path.join(temporal, "dump.sql");
    const dumpOriginal = prepararDumpDatos(descifrarArchivo(archivo, clave)).replace(
      "SELECT pg_catalog.set_config('search_path', '', false);",
      "SELECT pg_catalog.set_config('search_path', 'public, extensions, vault', false);",
    );
    writeFileSync(dump, dumpOriginal);
    docker(["exec", contenedor, "dropdb", "--if-exists", "-U", "supabase_admin", base]);
    docker(["exec", contenedor, "createdb", "-U", "supabase_admin", "-O", "supabase_admin", base]);
    docker([
      "exec",
      contenedor,
      "psql",
      "-U",
      "supabase_admin",
      "-d",
      base,
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-c",
      'create schema if not exists extensions; create schema if not exists vault; create extension if not exists btree_gist with schema public; create extension if not exists pg_trgm with schema public; create extension if not exists pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions;',
    ]);
    docker(
      ["exec", "-i", contenedor, "psql", "-U", "supabase_admin", "-d", base, "-v", "ON_ERROR_STOP=1", "-q"],
      readFileSync(dump, "utf8"),
    );
    const obtenidos = consultarConteos(contenedor, base);
    const diferencias = compararConteos(obtenidos, manifiesto.conteos);
    if (diferencias.length > 0) {
      throw new Error(`RESTAURACION_INCOMPLETA: ${diferencias.join("; ")}`);
    }
    const segundos = ((performance.now() - inicio) / 1000).toFixed(2);
    console.log(`RESTAURACION_OK segundos=${segundos} conteos=${JSON.stringify(obtenidos)}`);
  } finally {
    docker(["exec", contenedor, "dropdb", "--if-exists", "-U", "supabase_admin", base]);
    rmSync(temporal, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
