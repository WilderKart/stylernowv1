import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { limpiarEvento, limpiarMigaja } from "@/lib/sentry/comun";

/** Lo que Sentry recibe NUNCA debe llevar cookies, tokens, contraseñas, correos ni IP (la app maneja pagos y datos personales). */
function evento(parcial: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...parcial } as ErrorEvent;
}

describe("Sentry: limpieza de datos sensibles", () => {
  it("elimina cookies, cuerpo y cabeceras de la petición, pero conserva el id de petición como etiqueta", () => {
    const e = limpiarEvento(
      evento({
        request: {
          url: "https://app.stylernow.com/auth/callback?code=ABC123&next=/panel",
          cookies: { "sb-x-auth-token": "secreto" },
          data: { password: "hunter2" },
          headers: { authorization: "Bearer xyz", cookie: "a=b", "x-request-id": "req-123" },
          query_string: "code=ABC123&next=/panel",
        },
      }),
    );
    expect(e.request?.cookies).toBeUndefined();
    expect(e.request?.data).toBeUndefined();
    expect(e.request?.headers).toEqual({});
    expect(e.request?.url).not.toContain("ABC123");
    expect(decodeURIComponent(e.request?.url ?? "")).toContain("next=/panel");
    expect(e.request?.query_string).not.toContain("ABC123");
    expect(e.tags?.request_id).toBe("req-123");
  });

  it("del usuario deja solo el id (sin correo, IP ni nombre)", () => {
    const e = limpiarEvento(evento({ user: { id: "u-1", email: "a@b.com", ip_address: "1.2.3.4", username: "ana" } }));
    expect(e.user).toEqual({ id: "u-1" });
    expect(limpiarEvento(evento({ user: { email: "a@b.com" } })).user).toBeUndefined();
  });

  it("enmascara correos y JWT dentro de los mensajes de error", () => {
    const e = limpiarEvento(
      evento({
        message: "falló para ana@correo.com con eyJhbGciOiJI.eyJzdWIiOiIx.firmafirma123",
        exception: { values: [{ type: "Error", value: "no se pudo notificar a pedro@x.co" }] },
      }),
    );
    expect(e.message).toBe("falló para [email] con [Filtrado]");
    expect(e.exception?.values?.[0]?.value).toBe("no se pudo notificar a [email]");
  });

  it("enmascara por nombre de campo (token, password, tarjeta, teléfono…) y respeta el resto", () => {
    const e = limpiarEvento(
      evento({
        extra: { access_token: "t", password: "p", tarjeta: "4111", telefono: "300", anidado: { api_key: "k", ok: "visible" }, nota: "visible" },
      }),
    );
    expect(e.extra).toEqual({
      access_token: "[Filtrado]",
      password: "[Filtrado]",
      tarjeta: "[Filtrado]",
      telefono: "[Filtrado]",
      anidado: { api_key: "[Filtrado]", ok: "visible" },
      nota: "visible",
    });
  });

  it("migas de pan: descarta console.log, limpia URLs con tokens y textos con correos", () => {
    expect(limpiarMigaja({ category: "console", level: "log", message: "hola ana@x.com" })).toBeNull();
    const m = limpiarMigaja({ category: "fetch", data: { url: "/api/x?token=abc&p=1", method: "GET" } });
    expect(String(m?.data?.url)).not.toContain("abc");
    expect(String(m?.data?.url)).toContain("p=1");
    expect(limpiarMigaja({ category: "ui.click", message: "boton ana@x.com" })?.message).toBe("boton [email]");
  });
});
