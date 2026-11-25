import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  rpc: vi.fn(),
  contexto: { rol: "BARBERIA", negocioId: "neg-1" as string | null, userId: "u-1" },
  autorizacion: { ok: true as boolean, supabase: null as unknown, userId: "admin-1", error: undefined as string | undefined },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: estado.rpc, from: vi.fn() }) }));
vi.mock("@/lib/auth/resolver-contexto", () => ({ resolverContexto: async () => estado.contexto }));
vi.mock("@/lib/auth/autorizar-supersu", () => ({ autorizarSuperSU: async () => estado.autorizacion }));
vi.mock("@/lib/soporte/alertas", () => ({ procesarAlertasSoporte: vi.fn(async () => {}) }));

import { enviarMensajeChat } from "@/app/panel/soporte/chat-actions";
import { cambiarEstadoChatAdmin, enviarMensajeChatAdmin } from "@/app/admin/soporte/chat-actions";
import { procesarAlertasSoporte } from "@/lib/soporte/alertas";

const MENSAJE = {
  id: "msg-1",
  conversacion_id: "conv-1",
  negocio_id: "neg-1",
  remitente_rol: "BARBERIA",
  cuerpo: "mensaje privado",
  created_at: "2026-01-01T00:00:00.000Z",
  alerta_webhook: true,
  alerta_email_admin: true,
  alerta_email_negocio: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  estado.rpc.mockReset();
  estado.contexto = { rol: "BARBERIA", negocioId: "neg-1", userId: "u-1" };
  estado.autorizacion = { ok: true, supabase: { rpc: estado.rpc }, userId: "admin-1", error: undefined };
});

describe("soporte chat · server actions", () => {
  it("el dueño envía por RPC y dispara alertas con las banderas devueltas", async () => {
    estado.rpc.mockResolvedValue({ data: [MENSAJE], error: null });
    const res = await enviarMensajeChat("  hola soporte  ");
    expect(res.ok).toBe(true);
    expect(estado.rpc).toHaveBeenCalledWith("soporte_enviar_mensaje", {
      p_negocio_id: "neg-1",
      p_cuerpo: "  hola soporte  ",
    });
    expect(procesarAlertasSoporte).toHaveBeenCalledWith({
      negocioId: "neg-1",
      conversacionId: "conv-1",
      mensajeId: "msg-1",
      remitenteRol: "BARBERIA",
      alertaWebhook: true,
      alertaEmailAdmin: true,
      alertaEmailNegocio: false,
    });
  });

  it("traduce el gate de plan y no llama a alertas", async () => {
    estado.rpc.mockResolvedValue({ data: null, error: { message: "FUNCION_NO_INCLUIDA" } });
    const res = await enviarMensajeChat("hola");
    expect(res).toEqual({ ok: false, error: "El chat de soporte no está incluido en tu plan actual." });
    expect(procesarAlertasSoporte).not.toHaveBeenCalled();
  });

  it("STAFF y otra barbería quedan bloqueados antes del RPC", async () => {
    estado.contexto = { rol: "STAFF", negocioId: null, userId: "staff-1" };
    const res = await enviarMensajeChat("hola");
    expect(res.ok).toBe(false);
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it("SuperSU no autorizado no envía", async () => {
    estado.autorizacion = { ok: false, supabase: null, userId: "", error: "No tienes permiso de SuperSU." };
    const res = await enviarMensajeChatAdmin("neg-1", "respuesta");
    expect(res).toEqual({ ok: false, error: "No tienes permiso de SuperSU." });
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it("SuperSU autorizado responde y cambia el estado por RPC", async () => {
    estado.rpc.mockResolvedValueOnce({ data: [{ ...MENSAJE, remitente_rol: "SUPERSU" }], error: null });
    const enviado = await enviarMensajeChatAdmin("neg-1", "respuesta");
    expect(enviado.ok).toBe(true);
    expect(estado.rpc).toHaveBeenCalledWith("soporte_enviar_mensaje", { p_negocio_id: "neg-1", p_cuerpo: "respuesta" });

    estado.rpc.mockResolvedValueOnce({ data: [{ id: "conv-1" }], error: null });
    const cerrado = await cambiarEstadoChatAdmin("conv-1", "CERRADA");
    expect(cerrado.ok).toBe(true);
    expect(estado.rpc).toHaveBeenLastCalledWith("soporte_cambiar_estado", {
      p_conversacion_id: "conv-1",
      p_estado: "CERRADA",
    });
  });
});
