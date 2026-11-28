import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AVISO_PAGO_DIRECTO_SIN_REEMBOLSO, TEXTO_INFO_PAGO_DIRECTO } from "@/lib/pagos-directos/aviso";
import { MENSAJES_PAGOS_DIRECTOS, traducirErrorPagos } from "@/lib/pagos-directos/errores";

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
    expect(leer("src/lib/pagos-directos/aviso.ts")).toMatch(/no custodia ni valida transferencias/);
    expect(leer("src/app/reserva/[id]/pago/pantalla-pago.tsx")).toMatch(/AVISO_PAGO_DIRECTO_COMERCIO/);   // «Información importante» visible
    expect(leer("src/app/reserva/[id]/pago/pantalla-pago.tsx")).toMatch(/AVISO_PAGO_DIRECTO_SIN_REEMBOLSO/);
    expect(p).toMatch(/Guardar en galería/);
    expect(p).toMatch(/aceptaInfoPagoDirecto/);                       // la aceptación de la información importante viaja con el pago
    expect(leer("src/app/reserva/[id]/pago/actions.ts")).toMatch(/aceptar_informacion_pago_directo/);
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

describe("cancelación con pago directo: StylerNow no reembolsa", () => {
  it("el aviso al cliente es el texto acordado", () => {
    expect(AVISO_PAGO_DIRECTO_SIN_REEMBOLSO).toBe(
      "Este anticipo fue transferido directamente a la cuenta del comercio. StylerNow no custodia ni reembolsa ese dinero; cualquier devolución o acuerdo debes gestionarlo directamente con la barbería."
    );
  });
  it("cancelar_reserva ignora el reembolso con pago directo vigente: pct 0, sin pago de pasarela y bandera pago_directo", () => {
    const i = sql.indexOf("11. Cancelación con pago directo");
    expect(i).toBeGreaterThan(-1);
    const s = sql.slice(i);
    expect(s).toMatch(/v_pago_directo := exists \(select 1 from public\.pago_reserva where reserva_id = p_reserva_id[\s\S]{0,40}and metodo = ''TRANSFERENCIA_DIRECTA'' and estado <> ''RECHAZADO''\)/);
    expect(s).toMatch(/if v_pago_directo then v_pct := 0; v_tiene_pago := false; end if;/);
    expect(s).toMatch(/''pago_directo'', v_pago_directo/);
    // el guard queda ANTES de `if v_tiene_pago and v_pct > 0` (que es lo único que llama a _reembolso_crear)
    expect(s.indexOf("v_pago_directo then v_pct := 0")).toBeGreaterThan(s.indexOf("v_pago_directo := exists"));
    expect(sql).not.toMatch(/_reembolso_crear\(/);                    // 194 nunca crea reembolsos
    expect(sql).not.toMatch(/insert into public\.(reembolso|libro_movimiento|wallet_movimiento)\b/i);
  });
  it("registrar un pago directo no puede convivir con un anticipo ya cobrado por pasarela", () => {
    expect(cuerpoRpc("registrar_pago_directo_reserva")).toMatch(/tipo = 'SENA' and estado = 'APROBADO'\) then raise exception 'PAGO_YA_PROCESADO'/);
  });
  it("la pantalla de cancelación muestra el aviso en vez de un monto de reembolso", () => {
    const boton = leer("src/app/reserva/[id]/boton-cancelar.tsx");
    expect(boton).toMatch(/AVISO_PAGO_DIRECTO_SIN_REEMBOLSO/);                // sin monto a devolver, el aviso de siempre
    expect(boton).toMatch(/devol\.directo/);                                  // con pago completo: lo que debe devolver el negocio (207)
    expect(boton).toMatch(/pagoDirecto = false/);
    const pagina = leer("src/app/reserva/[id]/page.tsx");
    expect(pagina).toMatch(/pagado: pagoDirectoVigente \? pagadoDirecto : Number\(reserva\.monto_sena\)/);   // solo se informa lo que debe devolver el negocio; StylerNow no mueve ese dinero
    expect(pagina).toMatch(/pagoDirecto=\{pagoDirectoVigente\}/);
    expect(pagina).toMatch(/pagoDirectoVigente\s*\n?\s*\?\s*devolucion\.monto > 0 \? textoDirecto : AVISO_PAGO_DIRECTO_SIN_REEMBOLSO/);
    expect(leer("src/app/reserva/[id]/pago/pantalla-pago.tsx")).toMatch(/AVISO_PAGO_DIRECTO_SIN_REEMBOLSO/);
  });
  it("la acción de cancelar informa pagoDirecto y no dispara el worker de reembolsos sin monto", () => {
    const a = leer("src/app/reserva/[id]/actions.ts");
    expect(a).toMatch(/pagoDirecto: r\.pago_directo === true/);
    expect(a).toMatch(/if \(r\.reembolso_id && monto > 0\)\s*\{\s*await procesarReembolsosSinFallar/);
  });
});

describe("aviso al dueño al llegar un comprobante", () => {
  it("encola EMAIL, PUSH y PANEL con cliente, monto y enlace /panel/pagos, sin bloquear el registro", () => {
    const c = cuerpoRpc("registrar_pago_directo_reserva");
    expect(c).toMatch(/_notif_encolar_canales\('NEGOCIO_PAGO_DIRECTO_REPORTADO', v_owner, r\.negocio_id,/);
    expect(c).toMatch(/_notif_datos_reserva\(r, true\)[\s\S]*'ruta', '\/panel\/pagos'/);
    expect(c).toMatch(/_notif_monto\(p_monto_reportado, r\.negocio_id\)/);
    expect(c).toMatch(/array\['EMAIL', 'PUSH', 'PANEL'\]/);
    expect(c).toMatch(/exception when others then\s+null;/);                  // no bloqueante
    expect(c).toMatch(/owner_user_id/);                                       // destinatario: el dueño
    // la notificación va DESPUÉS de insertar y confirmar: un fallo de envío no revierte el pago
    expect(c.indexOf("_notif_encolar_canales")).toBeGreaterThan(c.indexOf("PAGO_DIRECTO_REPORTADO"));
  });
  it("el evento y sus plantillas existen en español e inglés para los 3 canales", () => {
    const i = sql.indexOf("10. Aviso al dueño");
    expect(i).toBeGreaterThan(-1);
    const s = sql.slice(i, sql.indexOf("11. Cancelación"));
    expect(s).toMatch(/'NEGOCIO_PAGO_DIRECTO_REPORTADO', 'TRANSACCIONAL', 'NEGOCIO'/);
    for (const canal of ["EMAIL", "PUSH", "PANEL"]) for (const idioma of ["es", "en"]) expect(s).toContain(`('${canal}', '${idioma}',`);
    expect(s).toMatch(/\{\{cliente\}\}[\s\S]*\{\{monto\}\}/);
  });
});

describe("tipos de base de datos regenerados", () => {
  const tipos = leer("src/types/database.ts");
  it("incluyen las tablas y RPC de la migración 194", () => {
    for (const nombre of ["pago_reserva", "negocio_medio_pago_directo", "cliente_saldo_pendiente", "cliente_saldo_movimiento"]) {
      expect(tipos).toContain(`      ${nombre}: {`);
    }
    for (const rpc of ["registrar_pago_directo_reserva", "verificar_pago_reserva", "anular_cita_por_pago_invalido", "marcar_pago_no_recibido_post_cita", "ajustar_saldo_pendiente_cliente", "saldo_pendiente_cliente", "medios_pago_directo_para_reserva"]) {
      expect(tipos).toContain(`      ${rpc}: {`);
    }
  });
  it("ya no quedan accesos tipados a mano (helpers sin-tipos retirados)", () => {
    for (const f of ["src/app/panel/pagos/actions.ts", "src/lib/pagos-directos/comprobante-actions.ts", "src/app/panel/pos/actions.ts", "src/app/reserva/[id]/pago/actions.ts"]) {
      expect(leer(f)).not.toMatch(/sin-tipos|rpcSinTipos|tabla\(supabase/);
    }
  });
});

describe("evidencia de la información importante del pago directo (migración 210)", () => {
  const m210 = leer("supabase/migrations/210_aceptacion_informacion_pago_directo.sql");
  it("el texto que se acepta en pantalla es idéntico al que guarda la base", () => {
    const enBase = m210.match(/select '(.*?)'\s*\n\s*\|\| '(.*?)'\s*\n\s*\|\| '(.*?)';/);
    expect(enBase).not.toBeNull();
    const texto = (enBase as RegExpMatchArray).slice(1, 4).join("");
    expect(texto).toBe(TEXTO_INFO_PAGO_DIRECTO);
  });
  it("la base exige la aceptación, la guarda inmutable y la copia al repositorio de evidencias", () => {
    expect(m210).toMatch(/trg_aceptacion_info_pago_inmutable/);
    expect(m210).toMatch(/_registrar_evidencia/);
    expect(m210).toMatch(/INFO_PAGO_DIRECTO_NO_ACEPTADA/);
    expect(m210).toMatch(/revoke all on function public\.aceptar_informacion_pago_directo\(uuid\) from public, anon, authenticated/);
  });
});
