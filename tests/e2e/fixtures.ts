import { expect, test as base, type Page } from "@playwright/test";

export const CLAVE_E2E = "E2e#Passw0rd!2026";

export const test = base.extend({
  page: async ({ page }, usar) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("stylernow_splash_visto", "1");
      } catch {
        return;
      }
    });
    await page.route("https://challenges.cloudflare.com/**", (ruta) =>
      ruta.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile={render:function(el,o){setTimeout(function(){o.callback&&o.callback("e2e-token");},0);return "e2e-widget";},reset:function(){},remove:function(){}};`,
      })
    );

    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      if (m.text().includes("/_next/hmr")) return;
      errores.push(`console: ${m.text()}`);
    });
    page.on("response", (r) => {
      if (r.status() < 400) return;
      const u = new URL(r.url());
      if (!["127.0.0.1", "localhost"].includes(u.hostname)) return;
      if (u.pathname === "/favicon.ico" || u.pathname.startsWith("/_next/")) return;
      errores.push(`HTTP ${r.status()} ${u.pathname}`);
    });

    await usar(page);
    expect(errores, errores.join("\n")).toEqual([]);
  },
});

export async function iniciarSesion(page: Page, correo: string, destino: string) {
  await page.goto("/login");
  await page.waitForFunction(() => Boolean((window as unknown as { turnstile?: unknown }).turnstile), null, { timeout: 30_000 });
  await page.locator('input[name="email"]').fill(correo);
  await page.locator('input[name="password"]').fill(CLAVE_E2E);
  await page.locator('form button[type="submit"]').first().click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 45_000 });
  const patron = new RegExp(`${destino.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$|\\?)`);
  for (let intento = 0; intento < 2; intento++) {
    await page.goto(destino);
    try {
      await expect(page).toHaveURL(patron, { timeout: 15_000 });
      return;
    } catch (error) {
      if (intento === 1) throw error;
    }
  }
}
