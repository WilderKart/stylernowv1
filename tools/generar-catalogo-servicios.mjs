// Genera src/lib/servicios/catalogo.generado.ts a partir de las carpetas de public/servicios.
// Cada carpeta es una categoría y cada imagen .webp es un servicio: el nombre del archivo es el nombre del servicio.
// Para añadir servicios al catálogo basta con copiar la imagen a su carpeta y ejecutar:  npm run catalogo:servicios
import { readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const carpeta = join(raiz, "public", "servicios");
const salida = join(raiz, "src", "lib", "servicios", "catalogo.generado.ts");

const NOMBRES_COMPLETOS = {
  "manicure/corte-unas": "Corte de uñas",
  "manicure/esmalte-gel": "Esmalte en gel",
  "manicure/limpieza-profunda-pies": "Limpieza profunda de pies",
  "manicure/manicura-basica": "Manicura básica",
  "manicure/manicura-estetica": "Manicura estética",
  "manicure/manicura-spa": "Manicura spa",
  "manicure/masaje-pies": "Masaje de pies",
  "manicure/pedicura-basica": "Pedicura básica",
  "manicure/pedicura-spa": "Pedicura spa",
  "manicure/tratamiento-parafina": "Tratamiento de parafina",
};
const ACENTOS = { tazon: "tazón", romano: "romano", basico: "básico", rizado: "rizado" };

function nombreLegible(cat, base) {
  const clave = `${cat}/${base}`;
  if (NOMBRES_COMPLETOS[clave]) return NOMBRES_COMPLETOS[clave];
  // Si ya viene escrito como nombre (mayúsculas/espacios), se respeta tal cual.
  if (/[A-Z\s]/.test(base)) return base.trim();
  const palabras = base.split("-").map((p) => ACENTOS[p] ?? p);
  const texto = palabras.join(" ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const categorias = readdirSync(carpeta).filter((d) => statSync(join(carpeta, d)).isDirectory()).sort();
const items = [];
for (const cat of categorias) {
  const archivos = readdirSync(join(carpeta, cat)).filter((f) => f.toLowerCase().endsWith(".webp") && !/^chatgpt/i.test(f)).sort((a, b) => a.localeCompare(b, "es"));
  for (const f of archivos) {
    const base = f.replace(/\.webp$/i, "");
    items.push({ id: `${cat}/${base}`, categoria: cat, nombre: nombreLegible(cat, base), imagen: encodeURI(`/servicios/${cat}/${f}`) });
  }
}

const cuerpo = `// ARCHIVO GENERADO por tools/generar-catalogo-servicios.mjs — no editar a mano (npm run catalogo:servicios).
export interface ServicioCatalogo {
  /** Clave estable: «categoría/archivo» sin extensión. */
  id: string;
  categoria: string;
  nombre: string;
  /** Ruta pública de la imagen (ya codificada). */
  imagen: string;
}

export const CATALOGO_SERVICIOS: ServicioCatalogo[] = ${JSON.stringify(items, null, 2)};
`;
writeFileSync(salida, cuerpo);
console.log(`Catálogo generado: ${items.length} servicios en ${categorias.length} categorías.`);
