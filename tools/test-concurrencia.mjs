import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidatos =
  process.platform === "win32"
    ? ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files (x86)\\Git\\bin\\bash.exe"]
    : ["bash"];
const bash = candidatos.find((c) => c === "bash" || existsSync(c)) ?? "bash";
const resultado = spawnSync(bash, [path.join(raiz, "tests", "sql", "reservas_concurrencia.sh")], {
  cwd: raiz,
  stdio: "inherit",
});
process.exit(resultado.status ?? 1);
