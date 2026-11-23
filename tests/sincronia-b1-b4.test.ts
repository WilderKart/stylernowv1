import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("B1/B4 fidelidad fuera de POS e idempotencia", () => {
  const sql = read("supabase/migrations/184_sincronia_b1_fidelidad_ads_gates.sql");

  it("define completar_reserva_sin_pos con gates y modo idempotente", () => {
    expect(sql).toMatch(/create or replace function public\.completar_reserva_sin_pos/);
    expect(sql).toMatch(/NO_AUTENTICADO/);
    expect(sql).toMatch(/NO_AUTORIZADO/);
    expect(sql).toMatch(/_exigir_operativo_reserva/);
    expect(sql).toMatch(/RESERVA_NO_COMPLETABLE/);
    expect(sql).toMatch(/idempotente', true/);
    expect(sql).toMatch(/fuente', 'agenda_sin_pos'/);
  });

  it("handlers de pipeline son idempotentes para venta_completada", () => {
    expect(sql).toMatch(/ux_punto_fidelizacion_reserva_origen/);
    expect(sql).toMatch(/ux_cashback_movimiento_regla_cliente_reserva/);
    expect(sql).toMatch(/ux_puntaje_staff_reserva_servicio/);
    expect(sql).toMatch(/on conflict \(negocio_id, cliente_id, origen\) where origen like 'RESERVA_COMPLETADA:%' do nothing/);
    expect(sql).toMatch(/on conflict \(regla_id, cliente_id, reserva_id\) where reserva_id is not null do nothing/);
  });

  it("alinea Ads v3 sin gate de plan ESSENTIAL/RAVEN en crear_campana_publicitaria", () => {
    expect(sql).toMatch(/Ads extra disponible en todos los planes/);
    expect(sql).toMatch(/plan_codigo\\\\s\*\(=\|in\)/);
    expect(sql).not.toMatch(/on conflict do nothing;\s*$/m);
  });
});

describe("B2/B3/B4 gates, permisos y sin prompt/confirm en alcance", () => {
  it("reportes actions y export exigen contexto/rol/operativo", () => {
    const actions = read("src/app/panel/reportes/actions.ts");
    const route = read("src/app/api/reportes/exportar/route.ts");
    for (const src of [actions, route]) {
      expect(src).toMatch(/resolverContexto/);
      expect(src).toMatch(/BARBERIA/);
      expect(src).toMatch(/exigirOperativo/);
    }
  });

  it("acciones sensibles devuelven rechazo por sesi?n/rol/tenant (401/403 l?gico)", () => {
    const casos: Array<[string, RegExp[]]> = [
      ["src/app/panel/whatsapp/actions.ts", [/sesionDuenoWhatsApp/, /requerirOperativo: true/, /traducirErrorWhatsApp/]],
      ["src/app/panel/promociones/actions.ts", [/resolverContexto/, /NO_AUTORIZADO/, /exigirOperativo/]],
      ["src/app/panel/lealtad/actions.ts", [/sesionDuenoLealtad/, /No autorizado|NO_AUTORIZADO/, /exigirOperativo/]],
      ["src/app/panel/reportes/actions.ts", [/No autorizado/, /resolverContexto/, /exigirOperativo/]],
      ["src/app/membresias/[id]/actions.ts", [/getUser\(\)/, /NO_AUTORIZADO/]],
      ["src/app/panel/verificacion/actions.ts", [/getUser\(\)/, /NO_AUTENTICADO/]],
      ["src/app/reserva/[id]/actions.ts", [/getUser\(\)/, /No tienes permiso/]],
    ];
    for (const [file, patterns] of casos) {
      const src = read(file);
      for (const p of patterns) expect(src).toMatch(p);
    }
  });

  it("whatsapp mutaciones exigen operativo", () => {
    const wa = read("src/app/panel/whatsapp/actions.ts");
    expect(wa).toMatch(/requerirOperativo: true/);
    expect(wa).toMatch(/sesionDuenoWhatsApp/);
  });

  it("ads page usa gate real por funci?n del plan", () => {
    const page = read("src/app/panel/ads/page.tsx");
    expect(page).toMatch(/negocio_tiene_funcion/);
    expect(page).toMatch(/publicidad_extra/);
    expect(page).not.toMatch(/planInsuficiente=\{false\}/);
  });

  it("no hay prompt/confirm en vistas objetivo B3", () => {
    const files = [
      "src/app/panel/inventario/vista-inventario.tsx",
      "src/app/panel/suscripcion/vista-suscripcion.tsx",
      "src/app/panel/staff/[id]/detalle-staff.tsx",
      "src/app/admin/moderacion/cola-moderacion.tsx",
      "src/app/admin/negocios/lista-negocios.tsx",
      "src/app/panel/lealtad/vista-lealtad-panel.tsx",
      "src/app/panel/reportes/vista-reportes.tsx",
    ];
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/\bprompt\(/);
      expect(src).not.toMatch(/\bconfirm\(/);
    }
  });
});
