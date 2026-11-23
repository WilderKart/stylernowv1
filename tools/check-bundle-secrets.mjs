import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PATRONES = [
  { nombre: "service_role", expresion: /service_role/i },
  { nombre: "SUPABASE_SECRET_KEY", expresion: /SUPABASE_SECRET_KEY/ },
  {
    nombre: "jwt",
    expresion: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  { nombre: "private_key", expresion: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
];

function archivosJavaScript(directorio) {
  if (!existsSync(directorio)) return [];
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = path.join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivosJavaScript(ruta);
    return ruta.endsWith(".js") ? [ruta] : [];
  });
}

export function buscarSecretosEnBundle(directorio) {
  return archivosJavaScript(directorio).flatMap((archivo) => {
    const lineas = readFileSync(archivo, "utf8").split(/\r?\n/);
    return lineas.flatMap((linea, indice) =>
      PATRONES.filter(({ expresion }) => expresion.test(linea)).map(({ nombre }) => ({
        archivo,
        patron: nombre,
        linea: indice + 1,
      })),
    );
  });
}

function main() {
  const objetivo = path.resolve(process.argv[2] ?? ".next/static");
  const hallazgos = buscarSecretosEnBundle(objetivo);
  if (hallazgos.length > 0) {
    console.error("SECRETOS_EN_BUNDLE");
    for (const hallazgo of hallazgos) {
      console.error(`${hallazgo.archivo}:${hallazgo.linea} ${hallazgo.patron}`);
    }
    process.exit(1);
  }
  console.log(`OK: sin secretos en ${objetivo}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
