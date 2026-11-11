#!/usr/bin/env node
// Genera docs/ROUTE_REGISTRY.md desde src/lib/routing/route-registry.ts —
// ese archivo es la única fuente real; este doc nunca se edita a mano.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const registro = readFileSync(join(RAIZ, "src/lib/routing/route-registry.ts"), "utf-8");

const regex = /\{\s*path:\s*"([^"]+)"\s*,\s*publica:\s*(true|false)(?:,\s*roles:\s*\[([^\]]*)\])?/g;
const filas = [];
let m;
while ((m = regex.exec(registro))) {
  const roles = m[3] ? m[3].split(",").map((r) => r.trim().replace(/"/g, "")).join(", ") : "";
  filas.push({ path: m[1], publica: m[2] === "true", roles });
}

const lineas = [
  "# Route Registry (generado — no editar a mano)",
  "",
  "Generado desde `src/lib/routing/route-registry.ts` por `tools/generar-route-registry-doc.mjs`.",
  "Fuente de verdad ejecutable: el archivo `.ts`, nunca este documento.",
  "",
  "| Ruta | Pública | Roles | Middleware |",
  "|---|---|---|---|",
  ...filas.map((f) => `| \`${f.path}\` | ${f.publica ? "Sí" : "No"} | ${f.roles || "—"} | proxy.ts |`),
  "",
];

writeFileSync(join(RAIZ, "docs/ROUTE_REGISTRY.md"), lineas.join("\n"));
console.log(`docs/ROUTE_REGISTRY.md generado con ${filas.length} rutas.`);
