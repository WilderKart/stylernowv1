import { beforeEach, describe, expect, it, vi } from "vitest";

type Consulta = { tabla: string; filtros: Record<string, string> };

const mocks = vi.hoisted(() => ({
  webhook: vi.fn(async () => {}),
  enviar: vi.fn(async (correo: { email: string; ruta: string; texto: string }) => ({ ok: true, email: correo.email })),
  seleccionar: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/notificaciones/adaptadores", () => ({ seleccionarAdaptador: mocks.seleccionar }));
vi.mock("@/lib/observabilidad/alertas", () => ({ enviarAlertaOperativa: mocks.webhook }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));

import { procesarAlertasSoporte, type DatosAlertaSoporte } from "@/lib/soporte/alertas";

let consultas: Consulta[];

beforeEach(() => {
  vi.clearAllMocks();
  consultas = [];
  mocks.seleccionar.mockReturnValue({ habilitado: true, enviar: mocks.enviar });
  mocks.from.mockImplementation((tabla: string) => {
    const consulta: Consulta = { tabla, filtros: {} };
    consultas.push(consulta);
    const cadena = {
      select: () => cadena,
      eq: (columna: string, valor: string | boolean) => {
        consulta.filtros[columna] = String(valor);
        return cadena;
      },
      limit: () => cadena,
      maybeSingle: async () => {
        if (tabla === "perfil" && consulta.filtros.es_supersu === "true") {
          return { data: { email: "admin@stylernow.test", nombre: "SuperSU" } };
        }
        if (tabla === "negocio") return { data: { owner_user_id: "u-1", nombre: "Barbería Test", plan_codigo: "PRESTIGE" } };
        if (tabla === "soporte_mensaje") return { data: { cuerpo: "necesito ayuda con Nequi", adjunto_tipo: null } };
        if (tabla === "perfil" && consulta.filtros.id === "u-1") {
          return { data: { email: "dueno@stylernow.test", nombre: "Dueño" } };
        }
        return { data: null };
      },
    };
    return cadena;
  });
});

const BASE: DatosAlertaSoporte = {
  negocioId: "neg-1",
  conversacionId: "conv-1",
  mensajeId: "msg-1",
  remitenteRol: "BARBERIA",
  alertaWebhook: false,
  alertaEmailAdmin: false,
  alertaEmailNegocio: false,
};

describe("soporte chat · alertas", () => {
  it("el webhook interno recibe negocio, plan, extracto y enlace directo (el correo nunca lleva el texto)", async () => {
    await procesarAlertasSoporte({ ...BASE, alertaWebhook: true, prioritario: true });
    expect(mocks.webhook).toHaveBeenCalledWith({
      tipo: "SOPORTE",
      titulo: "[PRIORITARIO] Nuevo mensaje de soporte",
      detalle: {
        conversacion_id: "conv-1",
        negocio_id: "neg-1",
        mensaje_id: "msg-1",
        remitente_rol: "BARBERIA",
        negocio: "Barbería Test",
        plan: "PRESTIGE",
        extracto: "necesito ayuda con Nequi",
        prioritario: true,
        con_adjunto: false,
        enlace: "https://app.stylernow.com/admin/soporte?c=conv-1",
      },
      severidad: "info",
    });
  });

  it("avisa a SuperSU y a la barbería sin incluir el mensaje en el correo", async () => {
    const datos = {
      ...BASE,
      remitenteRol: "SUPERSU",
      alertaEmailAdmin: true,
      alertaEmailNegocio: true,
      cuerpo: "contenido privado",
    } as DatosAlertaSoporte & { cuerpo: string };
    await procesarAlertasSoporte(datos);

    expect(consultas.map((c) => c.tabla)).toEqual(["perfil", "negocio", "perfil"]);
    expect(mocks.enviar).toHaveBeenCalledTimes(2);
    const correos = mocks.enviar.mock.calls.map(([m]) => m);
    expect(correos.map((m) => m.email)).toEqual(["admin@stylernow.test", "dueno@stylernow.test"]);
    expect(correos.map((m) => m.ruta)).toEqual(["https://app.stylernow.com/admin/soporte?c=conv-1", "https://app.stylernow.com/panel/soporte"]);
    for (const correo of correos) {
      expect(JSON.stringify(correo)).not.toContain("contenido privado");
      expect(correo.texto).toContain("no se incluye");
    }
  });
});

describe("enlaces de los correos de soporte", () => {
  it("siempre son absolutos (un enlace relativo en un correo se rompe como http:///admin/soporte)", async () => {
    const { enlaceAbsoluto } = await import("@/lib/soporte/alertas");
    const previo = process.env.NEXT_PUBLIC_SITE_URL;
    try {
      process.env.NEXT_PUBLIC_SITE_URL = "https://app.stylernow.com/";
      expect(enlaceAbsoluto("/admin/soporte?c=1")).toBe("https://app.stylernow.com/admin/soporte?c=1");
      process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"; // no https → dominio de producción
      expect(enlaceAbsoluto("/panel/soporte")).toBe("https://app.stylernow.com/panel/soporte");
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(enlaceAbsoluto("panel/soporte")).toBe("https://app.stylernow.com/panel/soporte");
    } finally {
      if (previo === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previo;
    }
  });
});
