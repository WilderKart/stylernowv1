import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  aCsv,
  CATEGORIAS,
  celdaCsv,
  COLUMNAS_LIBRO,
  ENTIDADES,
  ENCABEZADOS_EXPORTACION,
  ESTADOS,
  ETIQUETA_CATEGORIA,
  ETIQUETA_ESTADO,
  leerFiltros,
  rangoFechas,
  resumenEconomico,
  type MovimientoLibro,
  type TotalLibro,
} from "@/lib/libro/filtros";
import { cifrar, descifrar } from "@/lib/pagos/cifrado";
import {
  entornoPagos,
  liveModeCoincide,
  tiposExcluidosCobroNegocio,
  validarTokenParaEntorno,
} from "@/lib/pagos/entorno";
import { calcularSenaEstimada, calcularSenaServiciosEstimada, resumenPoliticaCancelacion } from "@/lib/pagos/sena";

const CLAVE_CIFRADO_ORIGINAL = process.env.PAGOS_CIFRADO_CLAVE;

beforeEach(() => {
  process.env.PAGOS_CIFRADO_CLAVE = randomBytes(32).toString("base64");
});

afterEach(() => {
  if (CLAVE_CIFRADO_ORIGINAL === undefined) delete process.env.PAGOS_CIFRADO_CLAVE;
  else process.env.PAGOS_CIFRADO_CLAVE = CLAVE_CIFRADO_ORIGINAL;
});

describe("Fase 7 · cifrado de credenciales de pago", () => {
  it("exige la clave configurada con su mensaje exacto", () => {
    delete process.env.PAGOS_CIFRADO_CLAVE;
    expect(() => cifrar("token")).toThrow("PAGOS_CIFRADO_NO_CONFIGURADO");
  });

  it("conserva UTF-8 completo en el ida y vuelta", () => {
    const texto = "áéñ 💡 Æ";
    expect(descifrar(cifrar(texto))).toBe(texto);
  });
});

describe("Fase 7 · entorno de pagos", () => {
  it("normaliza espacios y mayúsculas sin relajar la exigencia de Vercel production", () => {
    expect(entornoPagos({ MERCADOPAGO_ENTORNO: "  PRODUCCION  ", VERCEL_ENV: "production" })).toBe("PRODUCCION");
    expect(() => entornoPagos({ MERCADOPAGO_ENTORNO: " PRODUCCION ", VERCEL_ENV: "preview" })).toThrow(
      "MERCADOPAGO_ENTORNO=produccion solo se permite en el despliegue de producción de Vercel."
    );
    expect(entornoPagos({})).toBe("SANDBOX");
  });

  it("valora tokens y live_mode con mensajes y límites exactos", () => {
    expect(() => validarTokenParaEntorno("", "SANDBOX")).toThrow("TOKEN_VACIO");
    expect(() => validarTokenParaEntorno("TEST-1", "PRODUCCION")).toThrow("TOKEN_DE_PRUEBA_EN_PRODUCCION");
    expect(() => validarTokenParaEntorno("APP_USR-1", "PRODUCCION")).not.toThrow();
    expect(liveModeCoincide(undefined, "SANDBOX")).toBe(false);
    expect(liveModeCoincide(null, "PRODUCCION")).toBe(false);
    expect(liveModeCoincide(false, "SANDBOX")).toBe(true);
    expect(liveModeCoincide(true, "PRODUCCION")).toBe(true);
  });

  it("la bandera PSE se normaliza y nunca afecta a producción", () => {
    expect(tiposExcluidosCobroNegocio({ MERCADOPAGO_PSE_NEGOCIOS: " PROBAR " }, "SANDBOX")).toEqual(["ticket"]);
    expect(tiposExcluidosCobroNegocio({ MERCADOPAGO_PSE_NEGOCIOS: " PROBAR " }, "PRODUCCION")).toEqual([
      "bank_transfer",
      "ticket",
    ]);
    expect(tiposExcluidosCobroNegocio({}, "SANDBOX")).toEqual(["bank_transfer", "ticket"]);
  });
});

describe("Fase 7 · anticipo", () => {
  const base = { pago_completo_en_app: false, sena_pct: 20, sena_monto_fijo: null, sena_minimo: 5000, sena_maximo: 50000 };

  it("respeta el orden de las reglas de apagado, modo y pago completo", () => {
    expect(calcularSenaEstimada({ ...base, cobra_en_linea: false }, 40000)).toBe(0);
    expect(calcularSenaEstimada({ ...base, anticipo_modo: "NINGUNO" }, 40000)).toBe(0);
    expect(calcularSenaEstimada({ ...base, pago_completo_en_app: true, cobra_en_linea: false }, 40000)).toBe(0);
    expect(calcularSenaEstimada({ ...base, pago_completo_en_app: true }, 40000)).toBe(40000);
    expect(calcularSenaEstimada({ ...base, sena_pct: null }, 40000)).toBe(8000);
  });

  it("la política de cancelación es literal y no variable", () => {
    expect(
      resumenPoliticaCancelacion({ ventana_reembolso_total_horas: 24, ventana_reembolso_parcial_horas: 6, reembolso_parcial_pct: 50 })
    ).toEqual([
      "Cancelas con 24 h o más de anticipación: te devolvemos el 100% del anticipo.",
      "Cancelas entre 6 h y menos de 24 h antes: te devolvemos el 50%.",
      "Con menos de 6 h, o si no te presentas: el anticipo queda para el negocio por el espacio reservado.",
      "Si el negocio cancela, te devolvemos el 100% siempre, sin importar cuándo.",
    ]);
  });

  it("combina reglas por servicio, mínimo, máximo y tope del total", () => {
    expect(calcularSenaServiciosEstimada(base, [{ precio_base: 40000 }, { precio_base: 100000 }])).toBe(28000);
    expect(calcularSenaServiciosEstimada(base, [{ precio_base: 10000, anticipo_pct: 50 }, { precio_base: 20000 }])).toBe(9000);
    expect(calcularSenaServiciosEstimada(base, [{ precio_base: 10000, anticipo_pct: 5 }, { precio_base: 20000 }])).toBe(5000);
    expect(
      calcularSenaServiciosEstimada(base, [
        { precio_base: 100000, anticipo_pct: 80 },
        { precio_base: 100000 },
      ])
    ).toBe(50000);
    expect(calcularSenaServiciosEstimada(base, [{ precio_base: 8000, anticipo_monto_fijo: 12000 }, { precio_base: 20000 }])).toBe(12000);
    expect(calcularSenaServiciosEstimada(base, [{ precio_base: 10000, anticipo_pct: 50 }])).toBe(5000);
    expect(calcularSenaServiciosEstimada({ ...base, cobra_en_linea: false }, [{ precio_base: 40000 }])).toBe(0);
    expect(calcularSenaServiciosEstimada({ ...base, anticipo_modo: "NINGUNO" }, [{ precio_base: 40000 }])).toBe(0);
    expect(calcularSenaServiciosEstimada({ ...base, pago_completo_en_app: true }, [{ precio_base: 40000 }])).toBe(40000);
  });
});

describe("Fase 7 · libro financiero", () => {
  const CATEGORIAS_ESPERADAS = [
    "RESERVA",
    "ANTICIPO",
    "PAGO_SERVICIO",
    "PROPINA",
    "GIFT_CARD",
    "REDENCION_GIFT_CARD",
    "MEMBRESIA",
    "VENTA_LOCAL",
    "REEMBOLSO",
    "COMISION_PLATAFORMA",
    "PAGO_A_STYLERNOW",
    "INGRESO_PLATAFORMA",
    "AJUSTE",
  ];
  const ESTADOS_ESPERADOS = ["PENDIENTE", "CONFIRMADO", "FALLIDO", "REQUIERE_REVISION", "INFORMATIVO"];
  const ENTIDADES_ESPERADAS = ["NEGOCIO", "PLATAFORMA"];

  it("expone exactamente las categorías, estados, entidades y etiquetas publicadas", () => {
    expect(CATEGORIAS).toEqual(CATEGORIAS_ESPERADAS);
    expect(ESTADOS).toEqual(ESTADOS_ESPERADOS);
    expect(ENTIDADES).toEqual(ENTIDADES_ESPERADAS);
    expect(ETIQUETA_CATEGORIA).toEqual({
      RESERVA: "Reserva",
      ANTICIPO: "Anticipo",
      PAGO_SERVICIO: "Pago de servicio",
      PROPINA: "Propina",
      GIFT_CARD: "Gift card",
      REDENCION_GIFT_CARD: "Uso de gift card",
      MEMBRESIA: "Membresía",
      VENTA_LOCAL: "Venta en el local",
      REEMBOLSO: "Reembolso",
      COMISION_PLATAFORMA: "Comisión StylerNow",
      PAGO_A_STYLERNOW: "Pago a StylerNow",
      INGRESO_PLATAFORMA: "Ingreso StylerNow",
      AJUSTE: "Ajuste",
    });
    expect(ETIQUETA_ESTADO).toEqual({
      PENDIENTE: "Pendiente",
      CONFIRMADO: "Confirmado",
      FALLIDO: "Fallido",
      REQUIERE_REVISION: "En revisión",
      INFORMATIVO: "Informativo",
    });
  });

  it("valida todos los valores permitidos y descarta cualquiera otro", () => {
    for (const categoria of CATEGORIAS_ESPERADAS) expect(leerFiltros({ categoria }).categoria).toBe(categoria);
    for (const estado of ESTADOS_ESPERADOS) expect(leerFiltros({ estado }).estado).toBe(estado);
    for (const entidad of ENTIDADES_ESPERADAS) expect(leerFiltros({ entidad }).entidad).toBe(entidad);
    expect(leerFiltros({ categoria: "INVENTADA" })).toEqual({ pagina: 1 });
    expect(leerFiltros({ estado: "INVENTADO" })).toEqual({ pagina: 1 });
    expect(leerFiltros({ entidad: "INVENTADA" })).toEqual({ pagina: 1 });
  });

  it("convierte cadenas vacías a undefined y toma el primer valor de cada array", () => {
    expect(
      leerFiltros({ desde: "", hasta: "", categoria: "", estado: "", entidad: "", negocioId: "", referencia: "", pagina: "" })
    ).toEqual({ pagina: 1 });
    expect(leerFiltros({ categoria: ["ANTICIPO", "GIFT_CARD"], pagina: ["2", "4"] })).toEqual({ categoria: "ANTICIPO", pagina: 2 });
  });

  it("limita fechas, referencia, UUID y paginación sin ampliar el acceso", () => {
    expect(leerFiltros({ desde: "2026-1-01" })).toEqual({ pagina: 1 });
    expect(leerFiltros({ hasta: "2026/11/30" })).toEqual({ pagina: 1 });
    expect(leerFiltros({ referencia: "  ABC-123  " }).referencia).toBe("ABC-123");
    expect(leerFiltros({ referencia: "x".repeat(81) })).toEqual({ pagina: 1 });
    expect(leerFiltros({ negocioId: "11111111-1111-4111-8111-111111111111" }).negocioId).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(leerFiltros({ negocioId: "no-uuid" })).toEqual({ pagina: 1 });
    expect(leerFiltros({ pagina: "0" })).toEqual({ pagina: 1 });
    expect(leerFiltros({ pagina: "10001" })).toEqual({ pagina: 1 });
  });

  it("calcula rangos parciales o vacíos en hora de Colombia", () => {
    expect(rangoFechas({ desde: undefined, hasta: undefined })).toEqual({ desde: null, hasta: null });
    expect(rangoFechas({ desde: "2026-11-01", hasta: undefined })).toEqual({ desde: "2026-11-01T05:00:00.000Z", hasta: null });
    expect(rangoFechas({ desde: undefined, hasta: "2026-11-30" })).toEqual({
      desde: null,
      hasta: "2026-12-01T05:00:00.000Z",
    });
  });

  it("escapa celdas con todos los prefijos de fórmula y delimitadores", () => {
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(undefined)).toBe("");
    expect(celdaCsv(0)).toBe("0");
    expect(celdaCsv(-1000)).toBe("-1000");
    expect(celdaCsv("=SUM(1)")).toBe(`"'=SUM(1)"`);
    expect(celdaCsv("+57")).toBe(`"'+57"`);
    expect(celdaCsv("-x")).toBe(`"'-x"`);
    expect(celdaCsv("@cmd")).toBe(`"'@cmd"`);
    expect(celdaCsv("\t=x")).toBe("\"'\t=x\"");
    expect(celdaCsv("\r=x")).toBe("\"'\r=x\"");
    expect(celdaCsv("a;b")).toBe(`"a;b"`);
    expect(celdaCsv("a\nb")).toBe(`"a\nb"`);
    expect(celdaCsv('a"b')).toBe(`"a""b"`);
    expect(celdaCsv("'a")).toBe(`"'a"`);
  });

  it("exporta columnas y filas exactas con BOM", () => {
    expect(COLUMNAS_LIBRO).toBe(
      "id, entidad, negocio_id, categoria, evento, sentido, estado, monto, moneda, ocurrido_at, registrado_at, referencia_tipo, referencia_id, pago_id, reembolso_id, reserva_id, proveedor, id_externo, cuenta_recaudo, actor_tipo, ajusta_movimiento_id, motivo"
    );
    expect(ENCABEZADOS_EXPORTACION).toEqual([
      ["ocurrido_at", "Fecha"],
      ["entidad", "Entidad"],
      ["negocio_id", "Negocio"],
      ["categoria", "Categoría"],
      ["evento", "Evento"],
      ["sentido", "Sentido"],
      ["estado", "Estado"],
      ["monto", "Monto"],
      ["moneda", "Moneda"],
      ["proveedor", "Proveedor"],
      ["id_externo", "Id externo"],
      ["referencia_tipo", "Referencia"],
      ["referencia_id", "Id referencia"],
      ["pago_id", "Pago"],
      ["reembolso_id", "Reembolso"],
      ["reserva_id", "Reserva"],
      ["ajusta_movimiento_id", "Ajusta a"],
      ["motivo", "Motivo"],
      ["actor_tipo", "Origen"],
      ["id", "Id movimiento"],
    ]);

    const movimiento: MovimientoLibro = {
      id: "id-1",
      entidad: "NEGOCIO",
      negocio_id: "neg-1",
      categoria: "ANTICIPO",
      evento: "PAGO_CONFIRMADO",
      sentido: "INGRESO",
      estado: "CONFIRMADO",
      monto: 10000,
      moneda: "COP",
      ocurrido_at: "2026-11-12T10:00:00Z",
      registrado_at: "2026-11-12T10:01:00Z",
      referencia_tipo: "pago",
      referencia_id: "p-1",
      pago_id: "p-1",
      reembolso_id: null,
      reserva_id: "r-1",
      proveedor: "MERCADOPAGO",
      id_externo: "777",
      cuenta_recaudo: "NEGOCIO",
      actor_tipo: "SISTEMA",
      ajusta_movimiento_id: null,
      motivo: null,
    };
    expect(aCsv([movimiento])).toBe(
      "﻿Fecha,Entidad,Negocio,Categoría,Evento,Sentido,Estado,Monto,Moneda,Proveedor,Id externo,Referencia,Id referencia,Pago,Reembolso,Reserva,Ajusta a,Motivo,Origen,Id movimiento\r\n" +
        "2026-11-12T10:00:00Z,NEGOCIO,neg-1,ANTICIPO,PAGO_CONFIRMADO,INGRESO,CONFIRMADO,10000,COP,MERCADOPAGO,777,pago,p-1,p-1,,r-1,,,SISTEMA,id-1\r\n"
    );
  });

  it("resume solo ingresos y egresos confirmados, agrupados por moneda", () => {
    const total = (moneda: string, sentido: TotalLibro["sentido"], estado: TotalLibro["estado"], valor: number): TotalLibro => ({
      periodo: "2026-11-01",
      entidad: "NEGOCIO",
      categoria: "ANTICIPO",
      sentido,
      estado,
      moneda,
      cantidad: 1,
      total: valor,
    });
    expect(resumenEconomico([])).toEqual([]);
    expect(
      resumenEconomico([
        total("COP", "INGRESO", "CONFIRMADO", 100),
        total("COP", "EGRESO", "CONFIRMADO", 40),
        total("COP", "INGRESO", "PENDIENTE", 999),
        total("COP", "INFORMATIVO", "CONFIRMADO", 888),
        total("USD", "EGRESO", "CONFIRMADO", 10),
        total("USD", "INGRESO", "CONFIRMADO", 25),
      ])
    ).toEqual([
      { moneda: "COP", ingresos: 100, egresos: 40, neto: 60 },
      { moneda: "USD", ingresos: 25, egresos: 10, neto: 15 },
    ]);
  });
});
