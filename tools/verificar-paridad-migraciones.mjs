import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { leerVariable } from "./backup-supabase.mjs";

const CLAVES_HUELLA = ["columnas", "indices", "politicas", "restricciones", "disparadores", "funciones"];

export function versionesLocales(directorio = "supabase/migrations") {
  return readdirSync(directorio)
    .map((archivo) => archivo.match(/^(\d+)_.*\.sql$/)?.[1])
    .filter((version) => Boolean(version))
    .sort((a, b) => Number(a) - Number(b));
}

export function compararVersiones(locales, objetivo) {
  const conjuntoLocal = new Set(locales);
  const conjuntoObjetivo = new Set(objetivo);
  const ordenar = (a, b) => Number(a) - Number(b);
  return {
    faltantes: locales.filter((version) => !conjuntoObjetivo.has(version)).sort(ordenar),
    sobrantes: objetivo.filter((version) => !conjuntoLocal.has(version)).sort(ordenar),
  };
}

function ejecutarSupabase(args) {
  const npxCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
  const resultado = spawnSync(process.execPath, [npxCli, "supabase", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) throw new Error("COMANDO_SUPABASE_FALLO");
  return resultado.stdout ?? "";
}

function extraerJson(salida) {
  const coincidencia = salida.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!coincidencia) throw new Error(`SALIDA_JSON_INVALIDA: ${salida.slice(0, 300)}`);
  return JSON.parse(coincidencia[0]);
}

function consultar(objetivo, sql) {
  return extraerJson(ejecutarSupabase(["db", "query", ...objetivo, "--output", "json", sql]));
}

function consultarVersiones(objetivo) {
  return consultar(objetivo, "select version from supabase_migrations.schema_migrations order by version").map(
    (fila) => fila.version,
  );
}

function consultarHuella(objetivo) {
  const sql = "select (select count(*)::int from information_schema.columns where table_schema = 'public') as columnas, (select count(*)::int from pg_indexes where schemaname = 'public') as indices, (select count(*)::int from pg_policies where schemaname = 'public') as politicas, (select count(*)::int from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public') as restricciones, (select count(*)::int from pg_trigger tg join pg_class t on t.oid = tg.tgrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and not tg.tgisinternal) as disparadores, (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as funciones";
  return consultar(objetivo, sql)[0];
}

function argumentosObjetivo() {
  const argumentos = process.argv.slice(2);
  if (argumentos.includes("--local") || argumentos.length === 0) return ["--local"];
  if (argumentos.includes("--remoto")) {
    const dbUrl = leerVariable("DATABASE_URL");
    if (!dbUrl) throw new Error("Falta DATABASE_URL");
    return ["--db-url", dbUrl];
  }
  const indice = argumentos.indexOf("--db-url");
  if (indice >= 0 && argumentos[indice + 1]) return ["--db-url", argumentos[indice + 1]];
  throw new Error("Uso: node tools/verificar-paridad-migraciones.mjs [--local | --remoto | --db-url URL]");
}

function main() {
  const objetivo = argumentosObjetivo();
  const locales = versionesLocales();
  const objetivoVersiones = consultarVersiones(objetivo);
  const diferencia = compararVersiones(locales, objetivoVersiones);
  if (diferencia.faltantes.length > 0 || diferencia.sobrantes.length > 0) {
    console.error("PARIDAD_VERSIONES_FALLO");
    console.error(`faltantes=${diferencia.faltantes.join(",") || "-"}`);
    console.error(`sobrantes=${diferencia.sobrantes.join(",") || "-"}`);
    process.exit(1);
  }

  const local = consultarHuella(["--local"]);
  const destino = consultarHuella(objetivo);
  const divergencias = CLAVES_HUELLA.filter((clave) => Number(local[clave]) !== Number(destino[clave]));
  if (divergencias.length > 0) {
    console.error("PARIDAD_HUELLA_FALLO");
    for (const clave of divergencias) {
      console.error(`${clave}: local=${local[clave]} objetivo=${destino[clave]}`);
    }
    process.exit(1);
  }

  console.log(`PARIDAD_OK migraciones=${locales.length} huella=${JSON.stringify(destino)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
