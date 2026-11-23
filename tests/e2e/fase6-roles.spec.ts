import { expect } from "@playwright/test";
import { iniciarSesion, test } from "./fixtures";

const PUBLICAS = ["/", "/para-negocios", "/login", "/legal/terminos", "/legal/politica-de-datos", "/negocio/e2e-barberia", "/negocio/e2e-barberia/reservar"];

for (const ruta of PUBLICAS) {
  test(`pública ${ruta} sin desbordamiento`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page.locator("body")).toBeVisible();
    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(desborda, `desbordamiento horizontal en ${ruta}`).toBe(false);
  });
}

const ROLES = [
  { nombre: "cliente", correo: "e2e-cliente@stylernow.test", destino: "/cuenta" },
  { nombre: "dueño", correo: "e2e-dueno@stylernow.test", destino: "/panel" },
  { nombre: "staff", correo: "e2e-staff@stylernow.test", destino: "/staff" },
  { nombre: "guardián", correo: "e2e-guardian@stylernow.test", destino: "/panel/agenda" },
  { nombre: "superadmin", correo: "e2e-superadmin@stylernow.test", destino: "/admin" },
];

for (const rol of ROLES) {
  test(`ingreso y vista ${rol.nombre}`, async ({ page }) => {
    await iniciarSesion(page, rol.correo, rol.destino);
    await expect(page.locator("body")).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });
}
