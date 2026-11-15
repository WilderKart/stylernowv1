// Resume docs/plan_cierre/evidencias_1b/server_actions_<etiqueta>.json: por acción, ¿hubo fuga/escritura cruzada de actores ajenos al negocio B,
// y la llamada era válida (algún actor de B o el Super Admin consiguió ok:true)? Si no, el resultado de los ajenos es INCONCLUSO para esa acción.
import fs from "node:fs";
const arch = process.argv[2];
const j = JSON.parse(fs.readFileSync(arch, "utf8"));
const AJENOS = ["anonimo", "intruso", "cliente-a", "pro-a1", "guardian-a", "dueno-a"];
const BS = ["cliente-b", "pro-b1", "guardian-b", "dueno-b", "super"];
const porAccion = new Map();
for (const d of j.detalle) {
  const k = `${d.archivo}::${d.accion}`;
  if (!porAccion.has(k)) porAccion.set(k, []);
  porAccion.get(k).push(d);
}
const res = { VIOLACION: [], LIMPIA_CON_CONTROL: [], INCONCLUSA: [], NO_EJECUTADA: [] };
for (const [k, filas] of porAccion) {
  if (filas.every((f) => f.estado !== "EJECUTADA")) {
    res.NO_EJECUTADA.push({ k, estado: filas[0].estado, detalle: filas[0].detalle });
    continue;
  }
  const ajenos = filas.filter((f) => AJENOS.includes(f.actor) && f.estado === "EJECUTADA");
  const control = filas.filter((f) => BS.includes(f.actor) && f.ok && !f.lanzo);
  const malos = ajenos.filter((f) => f.fugaB || (f.escrituraB && f.escrituraB.length));
  if (malos.length) res.VIOLACION.push({ k, actores: malos.map((m) => `${m.actor}${m.fugaB ? "[lee B]" : ""}${m.escrituraB?.length ? "[escribe " + m.escrituraB.join("+") + "]" : ""}`), control: control.map((c) => c.actor) });
  else if (control.length) res.LIMPIA_CON_CONTROL.push({ k, control: control.map((c) => c.actor) });
  else res.INCONCLUSA.push({ k, error: filas.find((f) => f.error)?.error ?? filas.find((f) => f.lanzo)?.lanzo });
}
console.log(`acciones: ${porAccion.size}`);
for (const [c, v] of Object.entries(res)) console.log(`${c}: ${v.length}`);
console.log("\n== VIOLACIONES / FUGAS (a revisar una por una) ==");
for (const v of res.VIOLACION) console.log(" ", v.k, "→", v.actores.join(", "), "| control:", v.control.join(",") || "ninguno");
console.log("\n== INCONCLUSAS ==");
for (const v of res.INCONCLUSA) console.log(" ", v.k, "|", (v.error ?? "").slice(0, 80));
console.log("\n== NO EJECUTADAS ==");
for (const v of res.NO_EJECUTADA) console.log(" ", v.k, v.estado, (v.detalle ?? "").slice(0, 80));
fs.writeFileSync(arch.replace(".json", "_resumen.json"), JSON.stringify(res, null, 1));
