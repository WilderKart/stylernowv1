// Para cada acción: ¿qué respondieron los CONTROLES (cliente B, pro B1, guardián B, dueño B, super) y qué los AJENOS? Muestra el error del control, no el del primer actor.
import fs from "node:fs";
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const por = new Map();
for (const d of j.detalle) { const k = `${d.archivo}::${d.accion}`; if (!por.has(k)) por.set(k, []); por.get(k).push(d); }
const BS = ["cliente-b", "pro-b1", "guardian-b", "dueno-b", "super"];
for (const [k, f] of por) {
  const ctl = f.filter((x) => BS.includes(x.actor));
  const ok = ctl.filter((x) => x.ok && !x.lanzo).map((x) => x.actor);
  if (ok.length) continue;
  const errs = [...new Set(ctl.map((x) => (x.error || x.lanzo || "").slice(0, 70)))];
  console.log(k.padEnd(88), "| control:", errs.join(" // "));
}
