import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ETIQUETA_ESTADO, MENSAJES_ADICIONALES, fechaAdicional, traducirErrorAdicional } from "@/lib/adicionales/tipos";

vi.mock("server-only", () => ({}));

const MIGRACIONES = path.resolve(__dirname, "../supabase/migrations");
const leer = (f: string) => readFileSync(path.join(MIGRACIONES, f), "utf8");

describe("barberos adicionales · vocabulario único y migraciones", () => {
  it("las etiquetas de la interfaz cubren exactamente los estados definidos en la base (máquina única)", () => {
    const sql = leer("170_adicionales_modelo_lotes.sql");
    const bloque = sql.slice(sql.indexOf("insert into public.adicional_estado_def"), sql.indexOf("create table if not exists public.adicional_transicion"));
    const enBase = [...bloque.matchAll(/^\s*\('([A-Z_]+)'/gm)].map((m) => m[1]).sort();
    expect(enBase.length).toBe(11);
    expect(Object.keys(ETIQUETA_ESTADO).sort()).toEqual(enBase);
  });

  it("cada migración 169-177 tiene su reversión", () => {
    for (const n of [170, 171, 172, 173, 174, 175, 176, 177, 178]) {
      const archivos = readdirSyncSafe();
      expect(archivos.some((f) => f.startsWith(`${n}_`) && f.endsWith(".sql")), `falta ${n}.sql`).toBe(true);
      expect(archivos.some((f) => f.startsWith(`${n}_`) && f.endsWith("_REVERSION.sql.txt")), `falta reversión ${n}`).toBe(true);
    }
  });

  it("todas las funciones SECURITY DEFINER de las migraciones 169-177 fijan search_path y revocan a public, anon y authenticated", () => {
    for (const f of readdirSyncSafe().filter((x) => /^17[0-8]_/.test(x) && x.endsWith(".sql") && !x.includes("REVERSION"))) {
      const sql = leer(f);
      const definer = [...sql.matchAll(/create or replace function public\.(\w+)\([\s\S]*?security definer set search_path = public/gi)].map((m) => m[1]);
      for (const nombre of definer) {
        expect(sql, `${f}: ${nombre} sin REVOKE`).toMatch(new RegExp(`revoke all on function public\\.${nombre}\\([^)]*\\) from public, anon, authenticated`, "i"));
      }
    }
  });

  it("ninguna migración fija un precio, plazo o límite de adicionales fuera de las tablas de configuración", () => {
    const src = ["src/app/panel/staff/adicionales/actions.ts", "src/app/panel/staff/adicionales/vista-adicionales.tsx", "src/lib/adicionales/tipos.ts"]
      .map((f) => readFileSync(path.resolve(__dirname, "..", f), "utf8"))
      .join("\n");
    expect(src).not.toMatch(/51\.?900/);
    expect(src).not.toMatch(/155\.?700/);
  });
});

describe("barberos adicionales · alcance excluido", () => {
  it("no hay Preapproval, suscripciones automáticas ni tarjetas guardadas en lo implementado (170-178 y pantallas)", () => {
    const archivos = readdirSyncSafe().filter((x) => /^17[0-8]_/.test(x) && !x.includes("REVERSION"));
    for (const f of archivos) expect(leer(f).toLowerCase(), f).not.toMatch(/preapproval|card_token|authorized_payment/);
    for (const r of ["src/app/panel/staff/adicionales/actions.ts", "src/app/admin/adicionales/actions.ts"]) {
      expect(readFileSync(path.resolve(__dirname, "..", r), "utf8").toLowerCase(), r).not.toMatch(/preapproval|card_token/);
    }
  });
});

describe("barberos adicionales · mensajes y presentación", () => {
  it("traduce los códigos de error de la base y no filtra mensajes técnicos", () => {
    for (const k of Object.keys(MENSAJES_ADICIONALES)) expect(traducirErrorAdicional(`algo ${k} algo`)).toBe(MENSAJES_ADICIONALES[k]);
    expect(traducirErrorAdicional("duplicate key value violates unique constraint foo")).toBe("No pudimos completar la operación. Intenta de nuevo.");
  });
  it("las fechas se muestran en America/Bogota y los vacíos como guion", () => {
    expect(fechaAdicional(null)).toBe("—");
    expect(fechaAdicional("2026-12-18T04:30:00Z", "es-CO")).toMatch(/17/);   // 23:30 del 17 en Bogotá
  });
  it("el código y la base usan el mismo concepto de pago", () => {
    const sql = leer("173_adicionales_rpc_propietario.sql");
    expect(sql).toContain("'concepto', 'STAFF_EXTRA'");
    expect(readFileSync(path.resolve(__dirname, "../src/app/panel/suscripcion/actions.ts"), "utf8")).toContain('m.concepto === "STAFF_EXTRA"');
  });
});

const readdirSyncSafe = () => readdirSync(MIGRACIONES);
