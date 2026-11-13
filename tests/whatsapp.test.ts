import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { proveedorNoConectado, obtenerProveedor } from "@/lib/whatsapp/proveedor";
import {
  TRANSICIONES,
  consumir,
  cupoMarketing,
  elegirLote,
  envioHabilitado,
  normalizarSegmento,
  pctConsumido,
  resultadoProgramacion,
  saldoDisponible,
  transicionValida,
  umbralesAlcanzados,
  validarPlantilla,
  validarSegmento,
  variablesUsablesEnCampana,
  vencimientoRecarga,
  type LoteSimulado,
} from "@/lib/whatsapp/reglas";
import { traducirErrorWhatsApp } from "@/lib/whatsapp/errores";

const ahora = new Date("2026-11-15T12:00:00Z");
const lote = (p: Partial<LoteSimulado> & { id: string }): LoteSimulado => ({
  origen: "PAQUETE",
  disponible: 10,
  cupoMarketing: 1,
  marketingConsumido: 0,
  otorgado: new Date("2026-11-01T05:00:00Z"),
  vence: new Date("2027-11-01T05:00:00Z"),
  ...p,
});

describe("maquinas de estado (espejo de la migracion 120)", () => {
  it("el mapa TS coincide exactamente con el VALUES de _whatsapp_transicion_valida", () => {
    const sql = readFileSync(path.resolve(__dirname, "../supabase/migrations/120_whatsapp_modulo.sql"), "utf-8");
    const bloque = sql.slice(sql.indexOf("_whatsapp_transicion_valida(p_maquina"), sql.indexOf(") t(maquina, desde, hacia)"));
    const deSql = [...bloque.matchAll(/\('([A-Z_]+)','([A-Z_]+)','([A-Z_]+)'\)/g)].map((m) => `${m[1]}:${m[2]}>${m[3]}`).sort();
    const deTs = Object.entries(TRANSICIONES)
      .flatMap(([maquina, mapa]) => Object.entries(mapa as Record<string, readonly string[]>).flatMap(([d, hs]) => hs.map((h) => `${maquina}:${d}>${h}`)))
      .sort();
    expect(deSql.length).toBeGreaterThan(30);
    expect(deTs).toEqual(deSql);
  });

  it("ENVIADO / ENTREGADO / LEIDO no se alcanzan sin pasar por PREPARADO -> ENVIADO", () => {
    expect(transicionValida("MENSAJE", "BLOQUEADO_SIN_CONEXION", "ENVIADO")).toBe(false);
    expect(transicionValida("MENSAJE", "PREPARADO", "ENTREGADO")).toBe(false);
    expect(transicionValida("MENSAJE", "PREPARADO", "LEIDO")).toBe(false);
    expect(transicionValida("MENSAJE", "PREPARADO", "ENVIADO")).toBe(true);
    expect(transicionValida("MENSAJE", "LEIDO", "ENTREGADO")).toBe(false);
  });

  it("estados terminales no tienen salida", () => {
    expect(TRANSICIONES.CAMPANA.COMPLETADA).toHaveLength(0);
    expect(TRANSICIONES.CAMPANA.CANCELADA).toHaveLength(0);
    expect(TRANSICIONES.MENSAJE.FALLIDO).toHaveLength(0);
    expect(TRANSICIONES.MENSAJE.LEIDO).toHaveLength(0);
    expect(TRANSICIONES.COMPRA.ACREDITADA).toHaveLength(0);
  });

  it("campana: borrador puede quedar bloqueada sin conexion y luego programarse", () => {
    expect(transicionValida("CAMPANA", "BORRADOR", "BLOQUEADA_SIN_CONEXION")).toBe(true);
    expect(transicionValida("CAMPANA", "BLOQUEADA_SIN_CONEXION", "PROGRAMADA")).toBe(true);
    expect(transicionValida("CAMPANA", "BORRADOR", "EN_ENVIO")).toBe(false);
  });

  it("plantilla: la aprobacion solo sale de PENDIENTE_APROBACION", () => {
    expect(transicionValida("PLANTILLA", "BORRADOR", "APROBADA")).toBe(false);
    expect(transicionValida("PLANTILLA", "PENDIENTE_APROBACION", "APROBADA")).toBe(true);
  });

  it("compra: solo PENDIENTE_PAGO se acredita o cancela", () => {
    expect(transicionValida("COMPRA", "PENDIENTE_PAGO", "ACREDITADA")).toBe(true);
    expect(transicionValida("COMPRA", "CANCELADA", "ACREDITADA")).toBe(false);
  });

  it("solo PRODUCCION habilita el envio", () => {
    expect(envioHabilitado("PRODUCCION")).toBe(true);
    for (const e of ["NO_CONFIGURADO", "PENDIENTE_CREDENCIALES", "SANDBOX", "SUSPENDIDO", "REVOCADO", "ERROR"] as const) {
      expect(envioHabilitado(e)).toBe(false);
    }
  });
});

describe("tope de marketing", () => {
  it("40 % de las cuotas v3 (150/400/1000/2500)", () => {
    expect([150, 400, 1000, 2500].map((c) => cupoMarketing(c, 40))).toEqual([60, 160, 400, 1000]);
  });
  it("10 % de las recargas (500/1500/5000)", () => {
    expect([500, 1500, 5000].map((c) => cupoMarketing(c, 10))).toEqual([50, 150, 500]);
  });
  it("redondea hacia abajo y sin errores de coma flotante", () => {
    expect(cupoMarketing(400, 33.33)).toBe(133);
    expect(cupoMarketing(3, 33.34)).toBe(1);
    expect(cupoMarketing(10, 29)).toBe(2);
    expect(cupoMarketing(100, 0)).toBe(0);
    expect(cupoMarketing(100, 150)).toBe(100);
  });
});

describe("consumo y saldo", () => {
  const plan = lote({ id: "plan", origen: "PLAN", disponible: 2, cupoMarketing: 1, vence: new Date("2026-12-01T05:00:00Z") });
  const recargaVieja = lote({ id: "r1", vence: new Date("2026-11-20T05:00:00Z"), otorgado: new Date("2025-11-20T05:00:00Z"), cupoMarketing: 1 });
  const recargaNueva = lote({ id: "r2", vence: new Date("2027-10-01T05:00:00Z"), cupoMarketing: 1 });
  const vencida = lote({ id: "vencida", vence: new Date("2026-11-10T05:00:00Z"), otorgado: new Date("2025-11-10T05:00:00Z") });

  it("primero el plan aunque una recarga venza antes; luego recargas por vencimiento", () => {
    const lotes = [recargaNueva, recargaVieja, plan, vencida];
    expect(elegirLote(lotes, "UTILIDAD", ahora)?.id).toBe("plan");
    let estado = lotes;
    const orden: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = consumir(estado, "UTILIDAD", ahora);
      orden.push(r.loteId);
      estado = r.lotes;
    }
    expect(orden).toEqual(["plan", "plan", "r1", "r1"]);
  });

  it("nunca consume de lotes vencidos o futuros", () => {
    const futuro = lote({ id: "futuro", otorgado: new Date("2026-12-01T05:00:00Z") });
    expect(elegirLote([vencida, futuro], "UTILIDAD", ahora)).toBeNull();
    expect(() => consumir([vencida], "UTILIDAD", ahora)).toThrow("SALDO_INSUFICIENTE");
  });

  it("marketing respeta el tope de cada lote y salta al siguiente", () => {
    let estado = [plan, recargaNueva];
    const r1 = consumir(estado, "MARKETING", ahora);
    expect(r1.loteId).toBe("plan");
    estado = r1.lotes;
    const r2 = consumir(estado, "MARKETING", ahora);
    expect(r2.loteId).toBe("r2");
    expect(() => consumir(r2.lotes, "MARKETING", ahora)).toThrow("CUPO_MARKETING_AGOTADO");
    // Los avisos siguen saliendo aunque el marketing se haya agotado.
    expect(consumir(r2.lotes, "UTILIDAD", ahora).loteId).toBe("plan");
  });

  it("saldo de marketing = min(tope restante, disponible) por lote vigente", () => {
    const l = [lote({ id: "a", disponible: 3, cupoMarketing: 10, marketingConsumido: 2 }), lote({ id: "b", disponible: 5, cupoMarketing: 2 }), vencida];
    expect(saldoDisponible(l, ahora)).toEqual({ total: 8, marketing: 5 });
  });

  it("vencimiento de recarga: 12 meses, ajustando fin de mes", () => {
    expect(vencimientoRecarga(new Date("2026-11-12T10:00:00Z"), 12).toISOString()).toBe("2027-11-12T10:00:00.000Z");
    expect(vencimientoRecarga(new Date("2027-01-31T10:00:00Z"), 1).toISOString()).toBe("2027-02-28T10:00:00.000Z");
  });
});

describe("alertas de consumo", () => {
  it("porcentaje consumido de la cuota", () => {
    expect(pctConsumido(150, 30)).toBe(80);
    expect(pctConsumido(400, 0)).toBe(100);
    expect(pctConsumido(0, 0)).toBe(0);
    expect(pctConsumido(3, 2)).toBe(33.33);
  });
  it("umbrales 80 y 100", () => {
    expect(umbralesAlcanzados(79.99, [80, 100])).toEqual([]);
    expect(umbralesAlcanzados(80, [100, 80])).toEqual([80]);
    expect(umbralesAlcanzados(100, [80, 100, 80])).toEqual([80, 100]);
  });
});

describe("plantillas", () => {
  it("marcadores {{n}} deben coincidir en orden con las variables", () => {
    expect(validarPlantilla("Hola {{1}}, te espera {{2}}", ["nombre_cliente", "nombre_negocio"])).toBeNull();
    expect(validarPlantilla("Hola {{ 1 }} y otra vez {{1}}", ["nombre_cliente"])).toBeNull();
    expect(validarPlantilla("Sin variables", [])).toBeNull();
    expect(validarPlantilla("Hola {{2}}", ["nombre_cliente"])).toBe("MARCADORES_NO_COINCIDEN");
    expect(validarPlantilla("Hola {{1}}", [])).toBe("MARCADORES_NO_COINCIDEN");
    expect(validarPlantilla("Hola", ["nombre_cliente"])).toBe("MARCADORES_NO_COINCIDEN");
  });
  it("rechaza variables desconocidas, repetidas o texto vacio", () => {
    expect(validarPlantilla("{{1}}", ["telefono"])).toBe("VARIABLE_DESCONOCIDA");
    expect(validarPlantilla("{{1}} {{2}}", ["sede", "sede"])).toBe("VARIABLE_DUPLICADA");
    expect(validarPlantilla("   ", [])).toBe("CUERPO_INVALIDO");
    expect(validarPlantilla("x".repeat(1025), [])).toBe("CUERPO_INVALIDO");
  });
  it("campanas solo resuelven nombre del cliente y del negocio", () => {
    expect(variablesUsablesEnCampana(["nombre_cliente", "nombre_negocio"])).toBe(true);
    expect(variablesUsablesEnCampana(["fecha_cita"])).toBe(false);
  });
});

describe("segmentos", () => {
  it("acepta solo las claves conocidas con enteros en rango", () => {
    expect(validarSegmento({})).toBeNull();
    expect(validarSegmento({ dias_sin_visita_min: 30, visitas_min: 2, etiqueta: "VIP" })).toBeNull();
    expect(validarSegmento({ dias_sin_visita_min: null })).toBeNull();
    expect(validarSegmento({ clientes: ["uuid"] })).toBe("SEGMENTO_INVALIDO");
    expect(validarSegmento({ dias_sin_visita_min: 1.5 })).toBe("SEGMENTO_INVALIDO");
    expect(validarSegmento({ visitas_min: 0 })).toBe("SEGMENTO_INVALIDO");
    expect(validarSegmento([])).toBe("SEGMENTO_INVALIDO");
  });
  it("normaliza quitando filtros vacios", () => {
    expect(normalizarSegmento({ dias_sin_visita_min: null, visitas_min: 3, etiqueta: "  " })).toEqual({ visitas_min: 3 });
  });
});

describe("programacion de campanas", () => {
  const base = { destinatarios: 10, marketingDisponible: 60, conexion: "NO_CONFIGURADO" as const, plantilla: "BORRADOR" as const };
  it("sin conexion queda bloqueada (antes de exigir plantilla aprobada)", () => {
    expect(resultadoProgramacion(base)).toBe("BLOQUEADA_SIN_CONEXION");
  });
  it("valida destinatarios y cupo antes que la conexion", () => {
    expect(resultadoProgramacion({ ...base, destinatarios: 0 })).toBe("SIN_DESTINATARIOS");
    expect(resultadoProgramacion({ ...base, destinatarios: 61 })).toBe("CUPO_MARKETING_INSUFICIENTE");
  });
  it("con conexion exige plantilla aprobada", () => {
    expect(resultadoProgramacion({ ...base, conexion: "PRODUCCION" })).toBe("PLANTILLA_NO_APROBADA");
    expect(resultadoProgramacion({ ...base, conexion: "PRODUCCION", plantilla: "APROBADA" })).toBe("PROGRAMADA");
  });
});

describe("adaptador de proveedor", () => {
  it("sin conexion nunca simula exito", async () => {
    expect(obtenerProveedor()).toBe(proveedorNoConectado);
    const r = await proveedorNoConectado.enviarPlantilla({ telefono: "573001112233", plantillaNombre: "x", idioma: "es", variables: {} });
    expect(r).toEqual({ ok: false, motivo: "SIN_CONEXION" });
    expect((await proveedorNoConectado.solicitarAprobacionPlantilla({ nombre: "x", idioma: "es", categoria: "MARKETING", cuerpo: "Hola" })).ok).toBe(false);
    expect((await proveedorNoConectado.verificarConexion()).estado).toBe("NO_CONFIGURADO");
  });
});

describe("mensajes de error", () => {
  it("traduce codigos y no filtra textos internos", () => {
    expect(traducirErrorWhatsApp("ERROR: CUPO_MARKETING_INSUFICIENTE")).toMatch(/cupo/);
    expect(traducirErrorWhatsApp("PLANTILLA_NO_APROBADA")).toMatch(/aprobada/);
    expect(traducirErrorWhatsApp("relation secreta xyz")).toBe("No pudimos completar la acción. Intenta de nuevo.");
  });
});
