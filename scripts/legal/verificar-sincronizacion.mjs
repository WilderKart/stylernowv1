// Verifica que la migración de textos legales coincida carácter por carácter con las fuentes canónicas y que los datos de identificación sean los vigentes.
//   node scripts/legal/verificar-sincronizacion.mjs      → exit 0 si todo coincide; exit 1 si algo difiere.
// No se conecta a ninguna base de datos ni aplica nada.
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");
const norm = (s) => s.replace(/^\n+|\s+$/g, "");
const MIGRACION = "supabase/migrations/150_textos_legales_tawilstack.sql";
const m = leer(MIGRACION);
const bloque = (tag) => {
  const a = m.indexOf("$" + tag + "$");
  const b = m.indexOf("$" + tag + "$", a + 1);
  return a < 0 || b < 0 ? null : norm(m.slice(a + tag.length + 2, b));
};
let ok = true;
const falla = (msg) => { ok = false; console.log("FALLA:", msg); };

const tFuente = leer("docs/legal/TERMINOS_v4_borrador.txt");
const iT = tFuente.indexOf("Términos y Condiciones de Uso — StylerNow");
const pares = [
  ["terminos", iT >= 0 ? norm(tFuente.slice(iT)) : null, "docs/legal/TERMINOS_v4_borrador.txt (desde el título)"],
  ["politica", norm(leer("docs/legal/POLITICA_DATOS_v3_texto.txt")), "docs/legal/POLITICA_DATOS_v3_texto.txt"],
];
const textos = {};
for (const [tag, fuente, nombre] of pares) {
  const b = bloque(tag);
  textos[tag] = b ?? "";
  if (b === null || fuente === null) { falla(`${tag}: no se encontró el bloque o el título`); continue; }
  if (b === fuente) console.log(`OK  ${tag}: la migración coincide con ${nombre} (${b.length} caracteres)`);
  else {
    falla(`${tag}: la migración NO coincide con ${nombre} (${b.length} vs ${fuente.length} caracteres)`);
    const A = b.split("\n"), B = fuente.split("\n");
    for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) { console.log("  primera diferencia en la línea", i + 1); break; }
  }
}
const requeridos = ["TAWILSTACK S.A.S.", "NIT 902127652-0", "Calle 15B # 20-79", "Candelaria, Valle del Cauca", "equipo@stylernow.com", "+57 3183943465"];
const prohibidos = [/xxxxx/i, /Carrera 1A/i, /\[(PENDIENTE|COMPLETAR|DECISI[ÓO]N)/i, /soporte@stylernow/i, /en trámite de asignación/i];
for (const tag of ["terminos", "politica"]) {
  for (const r of requeridos) if (!textos[tag].includes(r)) falla(`${tag}: falta «${r}»`);
  for (const re of prohibidos) if (re.test(textos[tag])) falla(`${tag}: contiene un dato prohibido (${re})`);
}
if (/CREATE |ALTER |DROP |DELETE FROM|UPDATE public/i.test(m.replace(/\$(terminos|politica)\$[\s\S]*?\$\1\$/g, ""))) falla("la migración contiene sentencias de esquema o de borrado");
console.log(ok ? "\nTODO COINCIDE" : "\nHAY DIFERENCIAS");
process.exit(ok ? 0 : 1);
