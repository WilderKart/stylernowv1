import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const [a, r] of Object.entries(d.resumen)) console.log(a.padEnd(11), "esc_ok", r.escrituras_ok, "lec_datos", r.lecturas_con_datos, "tablas", r.tablas_cambiadas.join(",") || "-");
console.log("\nVIOLACIONES (no-super con ok:true en escritura o datos en lectura):");
const m = new Map();
for (const r of d.detalle) if (r.actor !== "super" && r.ok && (r.tipo === "escritura" || r.datos > 0)) { const k = `${r.modulo} ${r.fn} [${r.tipo}]`; m.set(k, [...(m.get(k) ?? []), `${r.actor}:${r.datos}`]); }
for (const [k, v] of m) console.log(" ", k, "->", v.join(" "));
console.log("\nCONTROL super que NO dio ok:");
for (const r of d.detalle) if (r.actor === "super" && !r.ok) console.log(" ", r.modulo, r.fn, r.lanzo ?? "", (r.error ?? "").slice(0, 100));
