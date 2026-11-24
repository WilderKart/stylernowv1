// Verifica el contraste (WCAG 2.x, nivel AA) de los temas suaves de src/styles/temas-suaves.css, en claro y oscuro.
// Uso: node scripts/verificar-contraste-temas.mjs   (termina con código 1 si algún par no cumple)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/temas-suaves.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function luminancia(hex) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// Cada bloque: «selectores { variables }». Se queda con los que definen --bg (los de paleta).
const bloques = [...css.matchAll(/([^{}]+)\{([^{}]*--bg:[^{}]*)\}/g)].map(([, sel, cuerpo]) => {
  const vars = Object.fromEntries([...cuerpo.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
  const vertical = /data-vertical="(\w+)"/.exec(sel)?.[1];
  const oscuro = /data-theme="dark"|data-modo="dark"/.test(sel);
  return { nombre: `${vertical} ${oscuro ? "oscuro" : "claro"}`, vars };
});

const primerColor = (grad) => [...grad.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);

let fallas = 0;
const fila = (bloque, etiqueta, a, b, minimo) => {
  const r = contraste(a, b);
  const ok = r >= minimo;
  if (!ok) fallas++;
  console.log(`${ok ? "OK   " : "FALLA"} ${bloque.padEnd(14)} ${etiqueta.padEnd(34)} ${r.toFixed(2)}:1 (mín ${minimo})`);
};

for (const { nombre, vars: v } of bloques) {
  for (const [fondo, f] of [["bg", v.bg], ["app-bg", v["app-bg"]], ["surface", v.surface]]) {
    fila(nombre, `text / ${fondo}`, v.text, f, 4.5);
    fila(nombre, `text-muted / ${fondo}`, v["text-muted"], f, 4.5);
    fila(nombre, `accent-text / ${fondo}`, v["accent-text"], f, 4.5);
  }
  fila(nombre, "text-faint / bg", v["text-faint"], v.bg, 4.5);
  fila(nombre, "ink / signal (texto en botón)", v.ink, v.signal, 4.5);
  fila(nombre, "ink / success", v.ink, v.success, 4.5);
  fila(nombre, "ink / danger", v.ink, v.danger, 4.5);
  fila(nombre, "borde de campo / bg", v["line-input"], v.bg, 3);
  fila(nombre, "nav-text / nav-bg", v["nav-text"], v["nav-bg"], 4.5);
  fila(nombre, "nav-accent / nav-bg", v["nav-accent"], v["nav-bg"], 4.5);
  for (const c of primerColor(v["hero-gradient"])) fila(nombre, `hero-text / hero ${c}`, v["hero-text"], c, 4.5);
  for (const c of primerColor(v["kpi-gradient"])) fila(nombre, `hero-text / kpi ${c}`, v["hero-text"], c, 4.5);
}

console.log(fallas === 0 ? "\nTodos los pares cumplen." : `\n${fallas} par(es) no cumplen.`);
process.exit(fallas === 0 ? 0 : 1);
