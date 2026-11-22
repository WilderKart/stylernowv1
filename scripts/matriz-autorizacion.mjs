// Fusiona las corridas del arnés dinámico de Server Actions y produce la matriz acción × actor + veredicto por acción.
//   node scripts/matriz-autorizacion.mjs  → docs/plan_cierre/fase1b_cierre/04_MATRIZ_AUTORIZACION.csv y resumen en consola (JSON en 04_matriz_resumen.json)
// Orden de preferencia de evidencia por acción: la corrida en la que algún CONTROL (actor autorizado sobre el negocio B) logró ejecutar la acción;
// si ninguna, la más reciente. Un veredicto SEGURA exige control válido o diferencial (ajenos denegados por autorización y controles pasando esa barrera).
import fs from "node:fs";
const E = "docs/plan_cierre/evidencias_1b/";
const CORRIDAS = [
  "server_actions_antes_139_codigo_actual.json", // 268 acciones, completa (previa a 139–142)
  "server_actions_candidato_app_lealtad__.json",
  "server_actions_candidato_app_negocio__slug__.json",
  "server_actions_candidato_app_panel_crm_.json",
  "server_actions_candidato_app_panel_ia_.json",
  "server_actions_candidato_app_panel_lealtad_.json", // candidato = con 139–142 aplicados
  "server_actions_pendientes_pasada1.json",
  "server_actions_pendientes_pasada2.json",
  "server_actions_pendientes_pasada3.json",
].filter((f) => fs.existsSync(E + f));
const AJENOS = ["anonimo", "intruso", "cliente-a", "pro-a1", "guardian-a", "dueno-a"];
const CONTROLES = ["cliente-b", "pro-b1", "guardian-b", "dueno-b", "super"];
const TODOS = [...AJENOS, ...CONTROLES];
const PERMISO = /no tienes permiso|no_autorizado|permission denied|row-level security|no es tuya|no es para tu cuenta|solo el due|solo puedes|solo una|no autorizado|acceso denegado|inicia sesi|no_autenticado|sesi[oó]n (expir|inv)|no encontramos|no_encontrad|not found/i;

const por = new Map(); // k -> [{corrida, filas}]
for (const c of CORRIDAS) {
  const j = JSON.parse(fs.readFileSync(E + c, "utf8"));
  const m = new Map();
  for (const d of j.detalle) { const k = `${d.archivo}::${d.accion}`; if (!m.has(k)) m.set(k, []); m.get(k).push(d); }
  for (const [k, filas] of m) { if (!por.has(k)) por.set(k, []); por.get(k).push({ corrida: c, filas }); }
}
const controlOk = (filas) => filas.some((f) => CONTROLES.includes(f.actor) && f.ok && !f.lanzo);
const celda = (f) => {
  if (!f) return "NO_EJECUTADO";
  if (f.estado === "OMITIDA") return "OMITIDA";
  if (f.estado !== "EJECUTADA") return "NO_IMPORTABLE";
  const marcas = [];
  if (f.ok && f.fugaB) marcas.push("LEE_B");
  if (f.escrituraB?.length) marcas.push("ESCRIBE_B:" + f.escrituraB.join("+"));
  if (f.ok) return ["OK", ...marcas].join("+");
  const msg = (f.error || f.lanzo || "").slice(0, 40);
  return (PERMISO.test(msg) ? "DENEGADO" : "ERROR_NEGOCIO") + (marcas.length ? "+" + marcas.join("+") : "");
};
// Justificación humana de marcas que NO son vulnerabilidades (cada una verificada en código y/o con consulta SQL; ver 03_AUDITORIA_SERVER_ACTIONS.md)
const NO_VIOLACION = {
  "app/negocio/[slug]/actions.ts::alternarFavorito": "Favorito PROPIO (la fila es del actor) de un negocio público.",
  "app/cuenta/actions.ts::exportarDatosAccion": "Exporta datos PROPIOS; incluye ese favorito propio.",
  "app/panel/agenda/actions.ts::listarServiciosActivos": "Catálogo público del negocio (RLS: solo negocio ACTIVO).",
  "app/panel/auditoria/actions.ts::listarAuditoriaNegocio": "Devuelve solo lo que RLS permite al actor; el 'lee B' es del propio negocio de un actor A cuando sus filas citan nombres de prueba.",
  "app/panel/soporte/actions.ts::listarMisTickets": "Tickets PROPIOS del actor.",
  "app/lealtad/actions.ts::registrarEventoFraude": "CORREGIDO por la migración 142 (antes sí escribía en el negocio ajeno).",
  "app/checkout/membresia/[planId]/actions.ts::iniciarCompraMembresia": "Compra propia: cada actor crea SU pago pendiente por una membresía pública del negocio B (el comprador es quien llama).",
  "app/gift-cards/comprar/actions.ts::iniciarCompraGiftCard": "Compra propia: gift card BLOQUEADA a nombre del comprador (verificado: comprador_id = actor).",
  "app/negocio/[slug]/reservar/actions.ts::unirseListaEspera": "Inscripción propia en la lista de espera pública (verificado: cliente_id = actor en cada fila).",
};
const filas = [];
const resumen = { SEGURA_DEMOSTRADA: [], SEGURA_DIFERENCIAL: [], NO_VIOLACION_REVISADA: [], VIOLACION: [], INCONCLUSA: [], OMITIDA: [] };
for (const [k, corridas] of [...por].sort()) {
  const elegida = corridas.filter((c) => controlOk(c.filas)).at(-1) ?? corridas.at(-1);
  const f = Object.fromEntries(elegida.filas.map((x) => [x.actor, x]));
  const celdas = TODOS.map((a) => celda(f[a]));
  const ajenos = AJENOS.map((a) => f[a]).filter((x) => x && x.estado === "EJECUTADA");
  const malos = ajenos.filter((x) => (x.ok && x.fugaB) || x.escrituraB?.length);
  const todasOmitidas = elegida.filas.every((x) => x.estado !== "EJECUTADA");
  let veredicto, motivo = "";
  if (todasOmitidas) { veredicto = "OMITIDA"; motivo = elegida.filas[0].estado === "OMITIDA" ? "Login/registro/Google/cierre de sesión: se analizan solo en estático" : "No importable en el arnés"; }
  else if (malos.length && NO_VIOLACION[k]) { veredicto = "NO_VIOLACION_REVISADA"; motivo = NO_VIOLACION[k]; }
  else if (malos.length) { veredicto = "VIOLACION"; motivo = malos.map((m) => m.actor).join(","); }
  else if (controlOk(elegida.filas)) { veredicto = "SEGURA_DEMOSTRADA"; motivo = "Control autorizado ejecutó la acción; los 6 ajenos no leyeron ni escribieron en B"; }
  else {
    const ajDen = ajenos.filter((x) => !x.ok && PERMISO.test(x.error || x.lanzo || "") && x.actor !== "anonimo");
    const ctlPasa = CONTROLES.map((a) => f[a]).filter((x) => x && x.estado === "EJECUTADA" && !x.ok && !PERMISO.test(x.error || x.lanzo || ""));
    if (ajDen.length >= 3 && ctlPasa.length >= 1) { veredicto = "SEGURA_DIFERENCIAL"; motivo = `Ajenos autenticados DENEGADOS por autorización; controles superan esa barrera y se detienen en regla de negocio/validación: «${(ctlPasa[0].error || ctlPasa[0].lanzo || "").slice(0, 60)}»`; }
    else { veredicto = "INCONCLUSA"; motivo = "Controles sin ejecutar: " + [...new Set(CONTROLES.map((a) => f[a]).filter(Boolean).map((x) => (x.error || x.lanzo || "").slice(0, 50)))].join(" // "); }
  }
  resumen[veredicto === "NO_VIOLACION_REVISADA" ? "NO_VIOLACION_REVISADA" : veredicto]?.push({ k, motivo });
  filas.push([k.split("::")[1], k.split("::")[0], ...celdas, veredicto, elegida.corrida.replace("server_actions_", "").replace(".json", ""), motivo]);
}
const cab = ["accion", "archivo", ...TODOS.map((a) => (AJENOS.includes(a) ? "ajeno:" : "autorizado_B:") + a), "veredicto", "corrida_de_evidencia", "motivo"];
const csv = [cab, ...filas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
fs.mkdirSync("docs/plan_cierre/fase1b_cierre", { recursive: true });
fs.writeFileSync("docs/plan_cierre/fase1b_cierre/04_MATRIZ_AUTORIZACION.csv", "﻿" + csv);
fs.writeFileSync("docs/plan_cierre/fase1b_cierre/04_matriz_resumen.json", JSON.stringify(resumen, null, 1));
console.log("acciones:", filas.length, "| corridas:", CORRIDAS.length);
for (const [k, v] of Object.entries(resumen)) console.log(k.padEnd(24), v.length);
for (const k of ["VIOLACION", "INCONCLUSA"]) { console.log("\n== " + k); for (const x of resumen[k]) console.log(" ", x.k, "|", x.motivo.slice(0, 140)); }
