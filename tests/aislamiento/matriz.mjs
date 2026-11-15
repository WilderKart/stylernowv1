// Matriz de aislamiento multi-tenant por HTTP REAL (PostgREST + JWT de cada actor) contra la base LOCAL de pruebas.
//   node tests/aislamiento/matriz.mjs            → imprime resumen y escribe docs/plan_cierre/evidencias/matriz_aislamiento.json
// Verdad de campo: los datos del negocio B (semilla). Actores que NO pertenecen a B: anon, intruso, cliente A, dueño A,
// guardián A, profesional A1/A2. Control positivo: dueño B y Super Admin (deben ver/operar sobre B).
// Escribe en la base local (PATCH/DELETE reales): se reconstruye con scripts/entorno-local/reiniciar.sh. NUNCA contra producción.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const API = process.env.SB_API ?? "http://127.0.0.1:55321";
if (!/^http:\/\/(127\.0\.0\.1|localhost):55321$/.test(API)) { console.error("RECHAZADO: solo la API local de pruebas (:55321)"); process.exit(2); }
const CONT = "supabase_db_stylernow-cierre";
const env = Object.fromEntries(execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", shell: process.platform === "win32" }).split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const ANON = env.ANON_KEY, SERVICE = env.SERVICE_ROLE_KEY;
const PW = readFileSync(".credenciales-pruebas.local", "utf8").match(/PW_PRUEBAS=(.*)/)[1].trim();
const psql = (sql) => execFileSync("docker", ["exec", "-i", CONT, "psql", "-U", "postgres", "-At", "-F", "|", "-c", sql], { encoding: "utf8" }).trim();

const B = { negocio: "00000000-0000-0000-0006-0000000001b0", sede: "00000000-0000-0000-0006-0000000002b0", cliente: "00000000-0000-0000-0006-0000000000b3",
  reserva: "00000000-0000-0000-0006-0000000004b0", staff: "00000000-0000-0000-0006-0000000000b2", dueno: "00000000-0000-0000-0006-0000000000b1" };
const ACTORES = ["anon", "intruso", "cliente-a", "dueno-a", "guardian-a", "pro-a1", "pro-a2"];
const CONTROLES = ["dueno-b", "super"];

async function login(alias) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: `${alias}@pruebas.test`, password: PW }) });
  const j = await r.json(); if (!j.access_token) throw new Error(`login ${alias}: ${JSON.stringify(j).slice(0, 100)}`); return j.access_token;
}
const tokens = { anon: null, service: SERVICE };
for (const a of [...ACTORES.filter((x) => x !== "anon"), ...CONTROLES]) tokens[a] = await login(a);
const h = (actor, extra = {}) => ({ apikey: ANON, ...(tokens[actor] ? { Authorization: `Bearer ${tokens[actor]}` } : {}), "Content-Type": "application/json", ...extra });
const rest = async (actor, path, init = {}) => { const r = await fetch(`${API}/rest/v1/${path}`, { ...init, headers: h(actor, init.headers) }); let b = null; try { b = await r.json(); } catch {} return { s: r.status, b }; };

// ── Tablas con columna que ata la fila a B ──────────────────────────────────
const cols = psql(`select c.table_name||'|'||string_agg(c.column_name, ',') from information_schema.columns c join pg_class k on k.relname=c.table_name and k.relnamespace='public'::regnamespace and k.relkind in ('r','p') where c.table_schema='public' and c.column_name in ('negocio_id','cliente_id','sede_id','reserva_id') group by c.table_name order by 1`).split("\n").filter(Boolean).map((l) => { const [t, c] = l.split("|"); return [t, c.split(",")]; });
const pk = Object.fromEntries(psql(`select cl.relname||'|'||a.attname from pg_index i join pg_class cl on cl.oid=i.indrelid join pg_attribute a on a.attrelid=cl.oid and a.attnum=any(i.indkey) where i.indisprimary and cl.relnamespace='public'::regnamespace`).split("\n").filter(Boolean).map((l) => l.split("|")));

const filtroB = (c) => (c.includes("negocio_id") ? `negocio_id=eq.${B.negocio}` : c.includes("sede_id") ? `sede_id=eq.${B.sede}` : c.includes("reserva_id") ? `reserva_id=eq.${B.reserva}` : `cliente_id=eq.${B.cliente}`);
const res = { lectura: [], escritura: [], borrado: [], insercion: [], rpc: [], cobertura: { tablas_con_filas_de_B: 0, tablas_sin_filas_de_B: [], tablas_total: cols.length } };

// 1) Lectura
const conFilas = [];
for (const [t, c] of cols) {
  const f = filtroB(c);
  const base = await rest("service", `${t}?${f}&select=*&limit=3`);
  if (base.s !== 200) { res.cobertura.tablas_sin_filas_de_B.push(`${t}(no legible: ${base.s})`); continue; }
  if (!base.b.length) { res.cobertura.tablas_sin_filas_de_B.push(t); continue; }
  conFilas.push([t, c, f, base.b]); res.cobertura.tablas_con_filas_de_B++;
  const fila = { tabla: t, filas_de_B: base.b.length };
  for (const a of [...ACTORES, ...CONTROLES]) { const r = await rest(a, `${t}?${f}&select=*&limit=3`); fila[a] = r.s === 200 ? r.b.length : `HTTP ${r.s}`; }
  res.lectura.push(fila);
}
// 2) Escritura (PATCH de la PK a su mismo valor) y 3) inserción
for (const [t, c, f, filas] of conFilas) {
  const llave = pk[t]; if (!llave || filas[0][llave] == null) continue;
  const fila = { tabla: t };
  for (const a of ACTORES) {
    const r = await rest(a, `${t}?${llave}=eq.${filas[0][llave]}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ [llave]: filas[0][llave] }) });
    fila[a] = r.s === 200 && Array.isArray(r.b) ? (r.b.length ? "MODIFICÓ" : "0 filas") : r.s === 401 || r.s === 403 ? "denegado" : `err ${r.b?.code ?? r.s}`;
  }
  res.escritura.push(fila);
  {
    // Fase 1A: se prueba la inserción en TODAS las tablas, atando la fila a B con su misma columna de tenant (antes solo con negocio_id).
    const [colT, valT] = f.split("=eq.");
    const fi = { tabla: t, columna: colT };
    for (const a of ACTORES) { const r = await rest(a, t, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ [colT]: valT }) }); fi[a] = r.s === 201 ? "INSERTÓ" : r.b?.code === "42501" || r.s === 401 || r.s === 403 ? "denegado" : `otro ${r.b?.code ?? r.s}`; }
    res.insercion.push(fi);
  }
}
// 4) Borrado (destructivo, al final)
for (const [t, c, f, filas] of conFilas) {
  const llave = pk[t]; if (!llave || filas[0][llave] == null) continue;
  const fila = { tabla: t };
  for (const a of ACTORES) {
    const r = await rest(a, `${t}?${llave}=eq.${filas[0][llave]}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
    fila[a] = r.s === 200 && Array.isArray(r.b) ? (r.b.length ? "BORRÓ" : "0 filas") : r.s === 401 || r.s === 403 ? "denegado" : `err ${r.b?.code ?? r.s}`;
  }
  res.borrado.push(fila);
}
// 5) RPC: funciones ejecutables por anon/authenticated, con argumentos que apuntan a B
const fns = psql(`select p.proname||'|'||coalesce(array_to_string(p.proargnames,','),'')||'|'||pg_get_function_identity_arguments(p.oid)||'|'||has_function_privilege('anon',p.oid,'execute')||'|'||has_function_privilege('authenticated',p.oid,'execute')||'|'||p.provolatile::text from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f' and p.proname not like 'trg\\_%' and has_function_privilege('authenticated',p.oid,'execute') and p.prorettype<>'trigger'::regtype and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') order by 1`).split("\n").filter(Boolean);
const valor = (n, tipo) => {
  if (/negocio/.test(n)) return B.negocio; if (/sede/.test(n)) return B.sede; if (/reserva/.test(n)) return B.reserva; if (/cliente|usuario|user/.test(n)) return B.cliente;
  if (/staff/.test(n)) return B.staff; if (/uuid\[\]/.test(tipo)) return []; if (/uuid/.test(tipo)) return B.negocio; if (/\b(integer|bigint|smallint)\b/.test(tipo)) return 1;
  if (/numeric|double|real/.test(tipo)) return 1; if (/boolean/.test(tipo)) return false; if (/jsonb|json/.test(tipo)) return {}; if (/timestamp/.test(tipo)) return new Date(Date.now() + 864e5).toISOString(); if (/date/.test(tipo)) return "2030-01-01"; return "x";
};
for (const l of fns) {
  const [nombre, , ident, anonExec, , vol] = l.split("|"); const args = {};
  if (ident) for (const parte of ident.split(/,\s(?=\w+ )/)) { const m = parte.trim().match(/^(?:IN |VARIADIC )?(\w+) (.+?)(?: DEFAULT .*)?$/); if (m) args[m[1]] = valor(m[1], m[2]); }
  const fila = { funcion: nombre, anon_ejecutable: anonExec === "true", admin: /^admin_|supersu/.test(nombre), volatil: vol === "v", con_id_de_B: Object.keys(args).some((k) => /negocio|sede|reserva|cliente|staff/.test(k)) };
  for (const a of ACTORES) { // solo actores SIN relación con B: los controles (Super/dueño B) alterarían el estado y falsearían las llamadas siguientes
    if (a === "anon" && anonExec !== "true") { fila[a] = "sin permiso"; continue; }
    const r = await fetch(`${API}/rest/v1/rpc/${nombre}`, { method: "POST", headers: h(a), body: JSON.stringify(args) }); let b = null; try { b = await r.json(); } catch {}
    fila[a] = r.status < 300 ? "EJECUTÓ" : /NO_AUTORIZADO|NO_AUTENTICADO|SOLO_SUPERSU|FORBIDDEN|permission denied|42501/i.test(JSON.stringify(b)) || r.status === 401 || r.status === 403 ? "denegado" : `err ${b?.code ?? r.status}:${String(b?.message ?? "").slice(0, 60)}`;
  }
  res.rpc.push(fila);
}

// ── Resumen ─────────────────────────────────────────────────────────────────
const bad = (v) => v === "MODIFICÓ" || v === "BORRÓ" || v === "INSERTÓ";
const lecturaFuga = res.lectura.filter((f) => ACTORES.some((a) => typeof f[a] === "number" && f[a] > 0));
const resumen = {
  tablas_analizadas: res.cobertura.tablas_total, tablas_con_datos_de_B: res.cobertura.tablas_con_filas_de_B,
  lectura_tablas_con_filas_de_B_visibles_a_no_autorizados: lecturaFuga.map((f) => ({ tabla: f.tabla, visibles_para: ACTORES.filter((a) => typeof f[a] === "number" && f[a] > 0) })),
  escritura_violaciones: res.escritura.filter((f) => ACTORES.some((a) => bad(f[a]))).map((f) => f.tabla),
  borrado_violaciones: res.borrado.filter((f) => ACTORES.some((a) => bad(f[a]))).map((f) => f.tabla),
  insercion_violaciones: res.insercion.filter((f) => ACTORES.some((a) => bad(f[a]))).map((f) => f.tabla),
  rpc_total: res.rpc.length,
  rpc_admin_ejecutadas_por_no_super: res.rpc.filter((f) => f.admin && ACTORES.some((a) => f[a] === "EJECUTÓ")).map((f) => ({ f: f.funcion, quien: ACTORES.filter((a) => f[a] === "EJECUTÓ") })),
  rpc_con_id_de_B_ejecutadas_por_no_autorizados_VOLATILES: res.rpc.filter((f) => !f.admin && f.volatil && f.con_id_de_B && ACTORES.some((a) => f[a] === "EJECUTÓ")).map((f) => ({ f: f.funcion, quien: ACTORES.filter((a) => f[a] === "EJECUTÓ") })),
  rpc_solo_lectura_con_id_de_B_ejecutadas_por_no_autorizados: res.rpc.filter((f) => !f.admin && !f.volatil && f.con_id_de_B && ACTORES.some((a) => f[a] === "EJECUTÓ")).map((f) => f.funcion),
  rpc_volatiles_ejecutadas_por_no_autorizados_sin_id_de_B: res.rpc.filter((f) => !f.admin && f.volatil && !f.con_id_de_B && ACTORES.some((a) => f[a] === "EJECUTÓ")).map((f) => f.funcion),
  control_positivo_dueno_b_ve_sus_filas_tablas: res.lectura.filter((f) => typeof f["dueno-b"] === "number" && f["dueno-b"] > 0).length,
  control_positivo_super_ve_filas: res.lectura.filter((f) => typeof f.super === "number" && f.super > 0).length,
};
mkdirSync("docs/plan_cierre/evidencias", { recursive: true });
writeFileSync("docs/plan_cierre/evidencias/matriz_aislamiento.json", JSON.stringify({ resumen, ...res }, null, 1));
console.log(JSON.stringify(resumen, null, 1));
