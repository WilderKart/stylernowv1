import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(async () => ({ error: null })),
  contexto: { rol: "BARBERIA", negocioId: "neg-1" as string | null, userId: "u-1" },
  autorizacion: { ok: true as boolean, supabase: null as unknown, userId: "admin-1", error: undefined as string | undefined },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// `after` solo existe dentro de una petición real; en la prueba se ejecuta al momento.
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: estado.rpc, from: vi.fn() }) }));
vi.mock("@/lib/auth/resolver-contexto", () => ({ resolverContexto: async () => estado.contexto }));
vi.mock("@/lib/auth/autorizar-supersu", () => ({ autorizarSuperSU: async () => estado.autorizacion }));
vi.mock("@/lib/soporte/alertas", () => ({ procesarAlertasSoporte: vi.fn(async () => {}) }));

import { guardarRespuestaRapida, listarRespuestasRapidas } from "@/app/admin/soporte/chat-actions";
import { enviarMensajeChat } from "@/app/panel/soporte/chat-actions";

const FILA = { id: "m1", conversacion_id: "c1", negocio_id: "neg-1", remitente_rol: "BARBERIA", cuerpo: "", created_at: "2026-01-01T00:00:00Z", alerta_webhook: true, alerta_email_admin: false, alerta_email_negocio: false, prioritario: false, tiene_adjunto: true };
const ADJUNTO = { ruta: "neg-1/c1/6f1c1d3e-0000-4000-8000-000000000000.webp", tipo: "IMAGEN" as const, nombre: "captura.webp" };

beforeEach(() => {
  vi.clearAllMocks();
  estado.rpc.mockReset();
  estado.contexto = { rol: "BARBERIA", negocioId: "neg-1", userId: "u-1" };
  estado.autorizacion = { ok: true, supabase: { rpc: estado.rpc, from: () => ({ insert: estado.insert }) }, userId: "admin-1", error: undefined };
});

describe("soporte chat · adjuntos", () => {
  it("envía un mensaje con solo adjunto y pasa la ruta, el tipo y el nombre a la base", async () => {
    estado.rpc.mockResolvedValue({ data: [FILA], error: null });
    const res = await enviarMensajeChat("", ADJUNTO);
    expect(res.ok).toBe(true);
    expect(estado.rpc).toHaveBeenCalledWith("soporte_enviar_mensaje", { p_negocio_id: "neg-1", p_cuerpo: "", p_adjunto_url: ADJUNTO.ruta, p_adjunto_tipo: "IMAGEN", p_adjunto_nombre: "captura.webp" });
  });

  it("traduce el rechazo de la base a un mensaje vacío sin adjunto", async () => {
    estado.rpc.mockResolvedValue({ data: null, error: { message: "MENSAJE_REQUERIDO" } });
    const res = await enviarMensajeChat("   ");
    expect(res).toEqual({ ok: false, error: "Escribe un mensaje antes de enviarlo." });
    expect(estado.rpc.mock.calls[0][1]).not.toHaveProperty("p_adjunto_url");
  });

  it("traduce un adjunto inválido", async () => {
    estado.rpc.mockResolvedValue({ data: null, error: { message: "ADJUNTO_INVALIDO" } });
    const res = await enviarMensajeChat("hola", ADJUNTO);
    expect(res).toEqual({ ok: false, error: "El archivo adjunto no es válido. Inténtalo de nuevo." });
  });

  it("un usuario que no es el dueño no llega a la base", async () => {
    estado.contexto = { rol: "STAFF", negocioId: "neg-1", userId: "u-2" };
    const res = await enviarMensajeChat("hola", ADJUNTO);
    expect(res.ok).toBe(false);
    expect(estado.rpc).not.toHaveBeenCalled();
  });
});

describe("soporte chat · respuestas rápidas (solo SuperSU)", () => {
  it("rechaza a quien no es SuperSU antes de tocar la base", async () => {
    estado.autorizacion = { ok: false, supabase: null, userId: "", error: "No tienes permiso de SuperSU." };
    expect((await guardarRespuestaRapida({ titulo: "x", atajo: "/xx", cuerpo: "y" })).ok).toBe(false);
    expect((await listarRespuestasRapidas()).ok).toBe(false);
    expect(estado.insert).not.toHaveBeenCalled();
  });

  it("valida el atajo y normaliza mayúsculas y la barra inicial", async () => {
    const mala = await guardarRespuestaRapida({ titulo: "x", atajo: "no valido!", cuerpo: "y" });
    expect(mala.ok).toBe(false);
    const ok = await guardarRespuestaRapida({ titulo: " Hola ", atajo: "HOLA", cuerpo: " texto " });
    expect(ok.ok).toBe(true);
    expect(estado.insert).toHaveBeenCalledWith({ titulo: "Hola", atajo: "/hola", cuerpo: "texto", activo: true, orden: 100 });
  });
});
