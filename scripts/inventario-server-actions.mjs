// Inventario ESTÁTICO de Server Actions fuera de /admin (Fase 1B). Solo lectura: no ejecuta nada.
// Para cada función exportada de un archivo "use server" saca: parámetros, si el archivo/función usa createAdminClient (RLS saltado),
// verificación de sesión, RPC invocadas, tablas escritas, validación (zod / checks), y registra rasgos para clasificar el riesgo.
// Uso: node scripts/inventario-server-actions.mjs  → docs/plan_cierre/evidencias_1b/inventario_server_actions.json
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const RAIZ = "src";
const archivos = [];
(function rec(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) rec(p);
    else if (/\.(ts|tsx)$/.test(e.name)) archivos.push(p.replaceAll("\\", "/"));
  }
})(RAIZ);

const salida = [];
for (const f of archivos) {
  if (f.startsWith("src/app/admin/")) continue;
  const txt = fs.readFileSync(f, "utf8");
  if (!/^\s*["']use server["']/m.test(txt.slice(0, 400))) continue;
  const sf = ts.createSourceFile(f, txt, ts.ScriptTarget.Latest, true);
  const usaAdminArchivo = /createAdminClient/.test(txt);
  // funciones locales (para atribuir usos de helpers de sesión)
  const cuerpoDe = new Map();
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name) cuerpoDe.set(n.name.text, n.getText(sf));
  });
  sf.forEachChild((n) => {
    if (!ts.isFunctionDeclaration(n) || !n.name) return;
    const exportada = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exportada) return;
    const cuerpo = n.getText(sf);
    // expande helpers locales llamados (un nivel) para detectar la sesión
    let ampliado = cuerpo;
    for (const [nombre, c] of cuerpoDe) if (nombre !== n.name.text && new RegExp(`\\b${nombre}\\(`).test(cuerpo)) ampliado += "\n" + c;
    const params = n.parameters.map((p) => ({ nombre: p.name.getText(sf), tipo: p.type ? p.type.getText(sf).slice(0, 120) : "any", opcional: !!p.questionToken || !!p.initializer }));
    const rpcs = [...new Set([...ampliado.matchAll(/\.rpc\(\s*["'`]([a-z0-9_]+)["'`]/g)].map((m) => m[1]))];
    const leidas = [...new Set([...ampliado.matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)\s*\.\s*select/g)].map((m) => m[1]))];
    const escritas = [...new Set([...ampliado.matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)\s*\.\s*(insert|update|delete|upsert)/g)].map((m) => `${m[1]}:${m[2]}`))];
    salida.push({
      archivo: f,
      accion: n.name.text,
      params,
      sesion: /auth\.getUser\(|auth\.getSession\(|usuarioActual\(|resolverContexto|requerirSesion|obtenerUsuario|exigirSesion/.test(ampliado),
      clienteAdmin: /createAdminClient\(/.test(ampliado),
      archivoUsaAdmin: usaAdminArchivo,
      rpcs,
      leidas,
      escritas,
      validaEntrada: /\bz\.|safeParse|\.parse\(|isUuid|UUID_RE|\.test\(/.test(ampliado),
      revalida: /revalidatePath|revalidateTag/.test(ampliado),
      fetchExterno: /\bfetch\(/.test(ampliado),
      lineas: n.getText(sf).split("\n").length,
    });
  });
}
fs.mkdirSync("docs/plan_cierre/evidencias_1b", { recursive: true });
fs.writeFileSync("docs/plan_cierre/evidencias_1b/inventario_server_actions.json", JSON.stringify(salida, null, 1));
const porArch = {};
for (const s of salida) porArch[s.archivo] = (porArch[s.archivo] ?? 0) + 1;
console.log(`acciones: ${salida.length}  archivos: ${Object.keys(porArch).length}`);
console.log(`sin verificación de sesión visible: ${salida.filter((s) => !s.sesion).length}`);
console.log(`con cliente admin (service role): ${salida.filter((s) => s.clienteAdmin).length}`);
console.log(`escriben tablas directo: ${salida.filter((s) => s.escritas.length).length}`);
console.log(`validan entrada visible: ${salida.filter((s) => s.validaEntrada).length}`);
