#!/usr/bin/env node
// ADR-015/016 — Auditoría de cobertura de autorización. Sin dependencias
// nuevas (fs/path nativos). Falla el build (exit 1) si encuentra:
//   1. una ruta (src/app/**/page.tsx) sin entrada en route-registry.ts;
//   2. una ruta privada sin ningún guard reconocido (ni en la página ni en
//      un layout.tsx ancestro);
//   3. un layout de superficie (admin/staff/panel) sin su guard esperado.
// Informa (no falla) cuántas páginas siguen en la capa de compatibilidad de
// ADR-016 (`verificarAccesoPanel`) vs. el contrato unificado (`requireRole`).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(RAIZ, "src", "app");
const REGISTRY_FILE = join(RAIZ, "src", "lib", "routing", "route-registry.ts");

const GUARDS_RECONOCIDOS = [
  "requireRole(",
  "verificarAccesoPanel(",
  "requireSuperSU(",
  "obtenerContextoStaff(",
  "resolverContexto(",
  // Patrón pre-ADR-015 usado por páginas de Cliente puro (perfil, reservas,
  // gift-cards, membresías, onboarding, sedes/nueva): chequeo directo de
  // sesión sin pasar por ningún resolver de rol de negocio — ya protegido
  // además por proxy.ts (Route Registry) a nivel Edge.
  "auth.getUser()",
];

function listarArchivos(dir, resultado = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const info = statSync(ruta);
    if (info.isDirectory()) listarArchivos(ruta, resultado);
    else resultado.push(ruta);
  }
  return resultado;
}

function archivoAPath(archivo) {
  // src/app/panel/crm/[clienteId]/page.tsx -> /panel/crm/[clienteId]
  const rel = relative(APP_DIR, dirname(archivo)).split(sep).join("/");
  return rel === "" ? "/" : `/${rel}`;
}

function cargarRutasDelRegistro() {
  const contenido = readFileSync(REGISTRY_FILE, "utf-8");
  const rutas = [];
  const regex = /\{\s*path:\s*"([^"]+)"\s*,\s*publica:\s*(true|false)/g;
  let m;
  while ((m = regex.exec(contenido))) rutas.push({ path: m[1], publica: m[2] === "true" });
  return rutas;
}

function normalizarSegmentosDinamicos(path) {
  // /panel/crm/[clienteId] -> /panel/crm  (para comparar contra el registro,
  // que registra el padre estático — ver buscarRuta() en route-registry.ts)
  return path.replace(/\/\[[^\]]+\]$/, "");
}

function coincideConRegistro(pathPagina, rutasRegistro) {
  const base = normalizarSegmentosDinamicos(pathPagina);
  const candidatas = rutasRegistro.filter((r) => base === r.path || base.startsWith(`${r.path}/`));
  if (candidatas.length === 0) return null;
  candidatas.sort((a, b) => b.path.length - a.path.length);
  return candidatas[0];
}

function tieneGuardPropio(contenido) {
  return GUARDS_RECONOCIDOS.some((g) => contenido.includes(g));
}

function buscarGuardEnLayoutsAncestros(dirPagina) {
  let dir = dirPagina;
  while (dir.startsWith(APP_DIR)) {
    const layout = join(dir, "layout.tsx");
    try {
      const contenido = readFileSync(layout, "utf-8");
      if (tieneGuardPropio(contenido)) return layout;
    } catch {
      /* no layout.tsx en este nivel, seguir subiendo */
    }
    if (dir === APP_DIR) break;
    dir = dirname(dir);
  }
  return null;
}

function main() {
  const errores = [];
  const avisos = [];
  let migradasUnificado = 0;
  let compatibilidad = 0;

  const rutasRegistro = cargarRutasDelRegistro();
  const paginas = listarArchivos(APP_DIR).filter((f) => f.endsWith(`${sep}page.tsx`));

  for (const archivo of paginas) {
    const pathPagina = archivoAPath(archivo);
    const rel = relative(RAIZ, archivo);
    const entrada = coincideConRegistro(pathPagina, rutasRegistro);

    if (!entrada) {
      errores.push(`Ruta sin registrar en route-registry.ts: ${pathPagina}  (${rel})`);
      continue;
    }
    if (entrada.publica) continue; // pública: no exige guard.

    const contenido = readFileSync(archivo, "utf-8");
    if (tieneGuardPropio(contenido)) {
      if (contenido.includes("requireRole(")) migradasUnificado++;
      if (contenido.includes("verificarAccesoPanel(")) compatibilidad++;
      continue;
    }

    const layoutConGuard = buscarGuardEnLayoutsAncestros(dirname(archivo));
    if (layoutConGuard) {
      avisos.push(`${pathPagina} — protegida por layout (${relative(RAIZ, layoutConGuard)}), no por sí misma.`);
      continue;
    }

    errores.push(`Ruta PRIVADA sin ningún guard reconocido (ni en la página ni en un layout ancestro): ${pathPagina}  (${rel})`);
  }

  // Layouts de superficie: deben tener su guard esperado.
  const LAYOUTS_ESPERADOS = [
    { archivo: "src/app/admin/layout.tsx", guard: "requireSuperSU(" },
    { archivo: "src/app/staff/layout.tsx", guard: "obtenerContextoStaff(" },
    { archivo: "src/app/panel/layout.tsx", guard: "auth.getUser" }, // guard de sesión, no de rol — ver panel/layout.tsx
  ];
  for (const { archivo, guard } of LAYOUTS_ESPERADOS) {
    try {
      const contenido = readFileSync(join(RAIZ, archivo), "utf-8");
      if (!contenido.includes(guard)) errores.push(`${archivo} no contiene el guard esperado (${guard})`);
    } catch {
      errores.push(`No se encontró ${archivo}`);
    }
  }

  // Route Handlers fuera de /api/** SÍ pasan por el gate público/protegido de
  // proxy.ts (a diferencia de /api/**, que el middleware exime por completo) —
  // encontrado como regresión real en ADR-015 Fase D: /auth/callback no tenía
  // entrada y el middleware lo trataba como protegido, rompiendo magic
  // link/recovery/Google (el usuario llega ahí SIN sesión, es la ruta que la crea).
  const routeHandlers = listarArchivos(APP_DIR).filter(
    (f) => f.endsWith(`${sep}route.ts`) && !relative(APP_DIR, f).split(sep).includes("api")
  );
  for (const archivo of routeHandlers) {
    const pathRuta = archivoAPath(archivo);
    const entrada = coincideConRegistro(pathRuta, rutasRegistro);
    if (!entrada) {
      errores.push(`Route Handler fuera de /api/** sin registrar en route-registry.ts: ${pathRuta}  (${relative(RAIZ, archivo)})`);
    }
  }

  console.log(`check-auth-coverage: ${paginas.length} páginas + ${routeHandlers.length} route handlers (fuera de /api/**) auditados.`);
  console.log(`  Contrato unificado (requireRole): ${migradasUnificado}`);
  console.log(`  Capa de compatibilidad (verificarAccesoPanel, ADR-016 pendiente): ${compatibilidad}`);
  if (avisos.length) {
    console.log(`\nAvisos (no fallan el build):`);
    for (const a of avisos) console.log(`  - ${a}`);
  }

  if (errores.length) {
    console.error(`\n❌ ${errores.length} problema(s) de cobertura de autorización:`);
    for (const e of errores) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("\n✅ Cobertura de autorización sin problemas.");
}

main();
