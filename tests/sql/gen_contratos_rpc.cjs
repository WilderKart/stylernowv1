// Genera la lista de contratos RPC (nombre, argumentos, si lo llama el servidor) leyendo src/. Uso: node tests/sql/gen_contratos_rpc.cjs > lista.txt
// y pegar las filas en el INSERT de tests/sql/f1b_compat_codigo_vs_base.sql.
const fs=require("fs"),path=require("path");
const out={};
function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(f.name)&&!p.includes("database.ts")){
const s=fs.readFileSync(p,"utf8");const re=/\.rpc\(\s*"([a-z_0-9]+)"\s*(?:,\s*(\{[^}]*\}))?/g;let m;
while((m=re.exec(s))){const keys=m[2]?[...m[2].matchAll(/\b(p_[a-z_0-9]+)\b/g)].map(x=>x[1]):[];
const admin=/createAdminClient|admin\.rpc|service/i.test(s.slice(Math.max(0,m.index-400),m.index));
const k=m[1];out[k]=out[k]||{args:new Set(),admin:false};keys.forEach(x=>out[k].args.add(x));if(admin)out[k].admin=true;}}}}
walk("src");
const rows=Object.entries(out).sort().map(([n,v])=>`('${n}','${[...v.args].sort().join(",")}',${v.admin})`);
console.log(rows.join(",\n"));console.error(rows.length);
