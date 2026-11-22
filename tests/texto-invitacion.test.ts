import { describe, expect, it } from "vitest";
import { textoInvitacion } from "@/lib/correo/texto-invitacion";

describe("correo de invitación al equipo", () => {
  const url = "https://app.test/invitacion/abc";
  it("dice el rol con el que se invita", () => {
    expect(textoInvitacion("BARBER", "Barbería X", "a@b.co", url).html).toContain("como profesional");
    const admin = textoInvitacion("BUSINESS_ADMIN", "Barbería X", "a@b.co", url);
    expect(admin.html).toContain("como administrador");
    expect(admin.html).toContain("No atenderás clientes");
    expect(admin.asunto).toContain("como administrador");
    expect(textoInvitacion("ADMIN_BARBER", "Barbería X", "a@b.co", url).html).toContain("como administrador y profesional");
  });
  it("escapa el nombre del negocio y el correo en el HTML y limpia saltos de línea del asunto", () => {
    const t = textoInvitacion("BARBER", "<b>Hack</b>\nBcc: x", "a<@b.co", url);
    expect(t.html).not.toContain("<b>Hack</b>");
    expect(t.html).toContain("&lt;b&gt;");
    expect(t.asunto).not.toMatch(/[\r\n]/);
  });
  it("incluye el enlace de aceptación", () => {
    expect(textoInvitacion("BARBER", "N", "a@b.co", url).html).toContain(url);
  });
});
