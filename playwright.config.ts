import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const raiz = process.cwd();
function entornoE2E() {
  const ruta = path.join(raiz, ".env.e2e.local");
  if (!fs.existsSync(ruta)) throw new Error("Falta .env.e2e.local: ejecuta npm run e2e:preparar");
  const salida: Record<string, string> = {};
  for (const linea of fs.readFileSync(ruta, "utf8").split("\n")) {
    const recorte = linea.trim();
    if (!recorte || recorte.startsWith("#")) continue;
    const separador = recorte.indexOf("=");
    if (separador < 0) continue;
    salida[recorte.slice(0, separador)] = recorte.slice(separador + 1);
  }
  return salida;
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    { name: "390", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "768", use: { browserName: "chromium", viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "1440", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 180_000,
    env: entornoE2E(),
  },
});
