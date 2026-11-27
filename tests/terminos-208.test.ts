import { calcularDevolucion, HORAS_MINIMAS_CANCELACION_NEGOCIO } from "@/lib/pagos/devolucion";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migracion = fs
  .readFileSync(path.join(process.cwd(), "supabase/migrations/208_terminos_cancelacion_negocio_y_resto_del_servicio.sql"), "utf8")
  .replace(/\r\n/g, "\n");

/** Los Términos (migración 208) y el código (migración 207, devolucion.ts) deben decir lo mismo. */
describe("Términos y Condiciones alineados con el código (208 ↔ 207)", () => {
  it("el ejemplo numérico de la cláusula 6 coincide con lo que calcula el código", () => {
    const pagado = 30000, anticipoBase = 10000;
    expect(calcularDevolucion({ pagado, anticipoBase, pct: 100 }).monto).toBe(30000);
    expect(calcularDevolucion({ pagado, anticipoBase, pct: 50 }).monto).toBe(25000);
    expect(calcularDevolucion({ pagado, anticipoBase, pct: 0 }).monto).toBe(20000);
    for (const frase of ["te devolvemos $30.000", "te devolvemos $25.000", "$20.000 del Resto del Servicio", "te devolvemos $20.000 y el Negocio conserva los $10.000"]) {
      expect(migracion).toContain(frase);
    }
  });

  it("la regla de horas del Negocio en los Términos es la que aplica la base de datos y la interfaz", () => {
    expect(migracion).toContain(`con ${HORAS_MINIMAS_CANCELACION_NEGOCIO} horas o más de anticipación a su hora de inicio`);
    const sql207 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/207_cancelacion_negocio_2h_y_devolucion_con_pago_total.sql"), "utf8");
    expect(sql207).toContain(`v_horas < ${HORAS_MINIMAS_CANCELACION_NEGOCIO}`);
  });

  it("publica una versión nueva material, a partir de la vigente, y aborta si el texto cambió", () => {
    expect(migracion).toMatch(/values \('TERMINOS', v_ult\.version \+ 1, v_txt, true\)/);
    expect(migracion).toMatch(/raise exception 'FRAGMENTO_%_INESPERADO/);
    expect(migracion).toContain("position('Resto del Servicio' in v_ult.contenido) > 0 then return");   // idempotente
  });

  it("reemplaza los siete fragmentos y ninguno de los textos nuevos vuelve a decir que el Anticipo puede ser todo el Servicio", () => {
    expect(migracion.split("|| E'").length - 1).toBeGreaterThanOrEqual(2);   // párrafos nuevos dentro de la cláusula 6
    expect(migracion).toContain("el Anticipo no es reembolsable y queda para el Negocio");
    expect(migracion.split("v_nuevo text[] := array[")[1]).not.toContain("hasta el valor total del Servicio");
  });
});
