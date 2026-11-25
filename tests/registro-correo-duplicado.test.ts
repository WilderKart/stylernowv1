import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  signUp: vi.fn(),
  guardarEnHistorial: vi.fn(async () => {}),
  fijarIntencionRegistro: vi.fn(async () => {}),
  fijarCategoriaAspecto: vi.fn(async () => {}),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (clave: string) => (clave === "host" ? "stylernow.test" : "https") }),
  cookies: async () => ({ get: vi.fn() }),
}));
vi.mock("@/lib/auth/aceptacion-legal", () => ({
  idsTextosVigentes: async () => [],
  registrarAceptacionDeRegistro: vi.fn(async () => {}),
  registrarAceptacionLegal: vi.fn(async () => {}),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: estado.signUp } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ update: () => ({ eq: vi.fn(async () => ({})) }) }),
    rpc: vi.fn(async () => ({ error: null })),
  }),
}));
vi.mock("@/lib/auth/password-validator", () => ({ validarContrasenaNueva: () => true }));
vi.mock("@/lib/auth/password-policy", () => ({ validarPolitica: async () => ({ ok: true }) }));
vi.mock("@/lib/auth/password-history", () => ({ guardarEnHistorial: estado.guardarEnHistorial }));
vi.mock("@/lib/auth/rate-limit-auth", () => ({
  registrarIntentoAuth: vi.fn(async () => {}),
  verificarRateLimitAuth: async () => ({ ok: true }),
}));
vi.mock("@/lib/auth/providers/google-provider", () => ({ googleProvider: {} }));
vi.mock("@/lib/auth/destino-seguro", () => ({ destinoSeguro: () => "/" }));
vi.mock("@/lib/tema/vertical", () => ({ esCategoriaRegistro: (valor: unknown) => typeof valor === "string" }));
vi.mock("@/lib/auth/destino-inicial", () => ({
  destinoInicial: () => "/",
  destinoPorIntencion: () => "/",
  fijarIntencionRegistro: estado.fijarIntencionRegistro,
}));
vi.mock("@/lib/tema/categoria-cookie", () => ({
  fijarAspectoDeCuenta: vi.fn(async () => {}),
  fijarCategoriaAspecto: estado.fijarCategoriaAspecto,
}));
vi.mock("@/lib/invitaciones/invitacion-pendiente", () => ({ obtenerInvitacionPendiente: async () => null }));
vi.mock("@/lib/rate-limit", () => ({ limitar: async () => ({ ok: true }), ipDelLlamador: () => "127.0.0.1" }));
vi.mock("@/lib/seguridad/turnstile", () => ({ verificarTurnstile: async () => true, MENSAJE_TURNSTILE: "prueba" }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { registrarCuenta } from "@/app/login/actions";
import { crearTraductor } from "@/lib/i18n/diccionario";

const DATOS = {
  tipo: "cliente",
  email: "existente@correo.com",
  password: "Abc12345!",
  confirmar: "Abc12345!",
  aceptaTerminos: true,
  siguiente: "/",
  turnstile: "token",
};

const DUPLICADO = {
  ok: false,
  campo: "email",
  error: "Ya estás registrado",
  yaRegistrado: true,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  estado.signUp.mockReset();
});

describe("registro · correo ya registrado", () => {
  it("devuelve el aviso cuando Supabase reporta user_already_exists", async () => {
    estado.signUp.mockResolvedValue({ data: null, error: { code: "user_already_exists", message: "User already registered" } });

    await expect(registrarCuenta(DATOS)).resolves.toEqual(DUPLICADO);
    expect(estado.guardarEnHistorial).not.toHaveBeenCalled();
    expect(estado.fijarIntencionRegistro).not.toHaveBeenCalled();
  });

  it("devuelve el aviso cuando Supabase devuelve usuario ficticio sin identidades", async () => {
    estado.signUp.mockResolvedValue({ data: { user: { id: "ficticio", identities: [] } }, error: null });

    await expect(registrarCuenta(DATOS)).resolves.toEqual(DUPLICADO);
    expect(estado.guardarEnHistorial).not.toHaveBeenCalled();
    expect(estado.fijarIntencionRegistro).not.toHaveBeenCalled();
  });

  it("crea la cuenta normalmente cuando sí hay identidades", async () => {
    estado.signUp.mockResolvedValue({ data: { user: { id: "real", identities: [{ id: "email" }] } }, error: null });

    await expect(registrarCuenta(DATOS)).resolves.toEqual({ ok: true, email: DATOS.email, siguiente: "/" });
    expect(estado.guardarEnHistorial).toHaveBeenCalledWith("real", DATOS.password);
    expect(estado.fijarIntencionRegistro).toHaveBeenCalledWith("real", "cliente", null);
  });

  it("expone el mensaje y el enlace exactos en español", () => {
    const t = crearTraductor("es");
    expect(t("auth.ya_registrado")).toBe("Ya estás registrado");
    expect(t("auth.ir_iniciar_sesion")).toBe("Ir a iniciar sesión");
  });
});
