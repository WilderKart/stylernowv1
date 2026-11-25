import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MENSAJES_PAGOS_DIRECTOS, traducirErrorPagos } from "@/lib/pagos-directos/sin-tipos";

const leer = (ruta: string) => readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
const sql = leer("supabase/migrations/194_pagos_directos_y_saldo_pendiente.sql");

/** Cuerpo de una función SQL por nombre (hasta su `end $$;`). */
function cuerpoRpc(nombre: string) {
  const i = sql.indexOf(`create or replace function public.${nombre}(`);
  expect(i, `falta la función ${nombre}`).toBeGreaterThan(-1);
  return sql.slice(i, sql.indexOf("end $$;", i));
}

describe("194 · permisos Zero Trust (solo dueño o SUPERSU)", () => {
  for (const rpc of ["verificar_pago_reserva", "anular_cita_por_pago_invalido", "marcar_pago_no_recibido_post_cita", "ajustar_saldo_pendiente_cliente"]) {
    it(`${rpc} exige dueño o SuperSU y nunca staff/guardián`, () => {
      const c = cuerpoRpc(rpc);
      expect(c).toMatch(/_es_dueno_o_supersu\(/);
      expect(c).toMatch(/NO_AUTORIZADO/);
      expect(c).not.toMatch(/is_guardian_de_sede|tiene_acceso_interno|staff_id\s*=\s*auth\.uid/);
    });
  }
  it("el auxiliar de permiso solo acepta is_barberia_de o is_supersu", () => {
    const c = cuerpoRpc("_es_dueno_o_supersu");
    expect(c).toMatch(/is_barberia_de/);
    expect(c).toMatch(/is_supersu/);
    expect(c).not.toMatch(/guardian|staff/i);
  });
  it("motivo obligatorio de al menos 10 caracteres en anular, no recibido y ajuste de saldo", () => {
    for (const rpc of ["anular_cita_por_pago_invalido", "marcar_pago_no_recibido_post_cita", "ajustar_saldo_pendiente_cliente"]) {
      expect(cuerpoRpc(rpc)).toMatch(/length\(trim\(coalesce\(p_motivo, ''\)\)\) < 10[\s\S]*MOTIVO_OBLIGATORIO/);
    }
  });
  it("toda RPC nueva revoca public/anon/authenticated y concede solo a authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.saldo_pendiente_cliente[\s\S]*from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.saldo_pendiente_cliente[\s\S]*to authenticated;/);
    expect(sql).not.toMatch(/grant execute on function public\.(verificar|anular|marcar|ajustar|registrar)[^;]*(anon|public)\b/);
  });
  it("nunca se borra una cita: anular pasa a CANCELADA con motivo PAGO_NO_VERIFICADO", () => {
    const c = cuerpoRpc("anular_cita_por_pago_invalido");
    expect(c).toMatch(/estado = 'CANCELADA'[\s\S]*cancelado_motivo = 'PAGO_NO_VERIFICADO'/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(reserva|pago_reserva)\b/i);
  });
  it("todo cambio de saldo y de pago deja rastro en evento_auditoria", () => {
    for (const rpc of ["verificar_pago_reserva", "anular_cita_por_pago_invalido", "marcar_pago_no_recibido_post_cita", "ajustar_saldo_pendiente_cliente", "registrar_pago_directo_reserva"]) {
      expect(cuerpoRpc(rpc)).toMatch(/_auditar_pago\(/);
    }
    expect(cuerpoRpc("_saldo_pendiente_liquidar")).toMatch(/_auditar_pago\(/);
    expect(cuerpoRpc("_auditar_pago")).toMatch(/'SUPERSU'/);
  });
});

describe("194 · comprobante único y saldo aislado por negocio", () => {
  it("índice único parcial (negocio_id, comprobante_hash) que excluye RECHAZADO", () => {
    expect(sql).toMatch(/create unique index if not exists pago_reserva_comprobante_unico\s+on public\.pago_reserva \(negocio_id, comprobante_hash\) where comprobante_hash is not null and estado <> 'RECHAZADO'/);
  });
  it("registrar valida hash SHA-256, ruta propia y traduce el duplicado", () => {
    const c = cuerpoRpc("registrar_pago_directo_reserva");
    expect(c).toMatch(/\^\[0-9a-f\]\{64\}\$/);
    expect(c).toMatch(/COMPROBANTE_DUPLICADO/);
    expect(c).toMatch(/r\.cliente_id is distinct from auth\.uid\(\)/);
  });
  it("saldo: clave (negocio_id, cliente_id), nunca negativo, y el cobro lo liquida a 0 con movimiento", () => {
    expect(sql).toMatch(/primary key \(negocio_id, cliente_id\)/);
    expect(sql).toMatch(/saldo_actual numeric\(12,2\) not null default 0 check \(saldo_actual >= 0\)/);
    expect(cuerpoRpc("_saldo_pendiente_liquidar")).toMatch(/saldo_actual = 0[\s\S]*'COBRO_POS'/);
  });
  it("el POS descuenta el anticipo reportado (no el RECHAZADO) y suma el saldo pendiente", () => {
    expect(sql).toMatch(/_anticipo_descontado_reserva\(p_reserva_id\), 0\) \+ v_total_productos/);
    expect(cuerpoRpc("_anticipo_descontado_reserva")).toMatch(/if v_pago\.estado = 'RECHAZADO' then return 0;/);
    expect(sql).toMatch(/v_deuda := public\._saldo_pendiente_liquidar/);
  });
  it("completar sin POS NO liquida saldos (evita que un staff borre deudas sin cobrar)", () => {
    const i = sql.indexOf("Completar sin POS: no se cobra nada");
    expect(i).toBeGreaterThan(-1);
    expect(sql.slice(i, sql.indexOf("revoke all on function public.completar_venta_pos", i))).not.toMatch(/_saldo_pendiente_liquidar/);
  });
});

describe("capa de aplicación", () => {
  it("las acciones del panel de pagos solo aceptan al dueño y toman el negocio del contexto", () => {
    const a = leer("src/app/panel/pagos/actions.ts");
    expect(a).toMatch(/contexto\.rol !== "BARBERIA"/);
    expect(a).not.toMatch(/negocioId:\s*string,\s*clienteId/); // el negocio no llega del navegador
  });
  it("el comprobante del barbero es de solo lectura: sin acciones de aprobar/rechazar/ajustar", () => {
    const v = leer("src/components/pagos/ver-comprobante.tsx");
    const l = leer("src/lib/pagos-directos/comprobante-actions.ts");
    for (const src of [v, l]) {
      expect(src).not.toMatch(/verificarPago|anularCita|marcarPagoNoRecibido|ajustarSaldo|rpc\(/);
    }
    for (const f of ["src/app/staff/agenda/vista-agenda-staff.tsx", "src/app/panel/pos/lista-pos.tsx"]) {
      expect(leer(f)).not.toMatch(/panel\/pagos\/actions/);
    }
  });
  it("el ajuste de saldo en el CRM usa confirmar() y nunca window.confirm", () => {
    const s = leer("src/app/panel/crm/[clienteId]/saldo-pendiente.tsx");
    expect(s).toMatch(/confirmar\(/);
    expect(s).not.toMatch(/window\.confirm/);
    expect(leer("src/app/panel/pagos/vista-pagos.tsx")).not.toMatch(/window\.confirm/);
  });
  it("el comprobante se sube directo a Storage (no por Server Action) con aviso legal visible", () => {
    const p = leer("src/app/reserva/[id]/pago/pago-directo.tsx");
    expect(p).toMatch(/storage\.from\("pagos-directos"\)\.upload/);
    expect(p).toMatch(/no custodia ni valida transferencias/);
    expect(p).toMatch(/Guardar QR en galería/);
    expect(leer("src/lib/imagen/comprimir.ts")).toMatch(/MAX_COMPROBANTE_BYTES = 300 \* 1024/);
  });
  it("no se redefinen los flujos de cobro de Wompi ni Mercado Pago", () => {
    expect(sql).not.toMatch(/create or replace function public\.(crear_pago_sena|aplicar_evento_pago|conexion_)/);
  });
});

describe("mensajes de error en español", () => {
  it("traduce los códigos conocidos y oculta los desconocidos", () => {
    expect(traducirErrorPagos("NO_AUTORIZADO")).toMatch(/dueño/);
    expect(traducirErrorPagos("COMPROBANTE_DUPLICADO")).toMatch(/otra cita/);
    expect(traducirErrorPagos("relation x does not exist")).toBe("No pudimos completar la acción. Intenta de nuevo.");
    for (const m of Object.values(MENSAJES_PAGOS_DIRECTOS)) expect(m).not.toMatch(/[A-Z_]{8,}/);
  });
});
