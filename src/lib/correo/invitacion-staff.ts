import "server-only";

import { headers } from "next/headers";
import { REMITENTE_CORREO } from "./remitente";

/**
 * Correo de invitación a Staff (único punto de envío: panel de Staff y paso 4 del onboarding).
 *
 * Antes el resultado de Resend se ignoraba: si Resend rechazaba el envío, la pantalla decía
 * «invitación enviada» y nadie se enteraba. Ahora:
 *  · se revisa la respuesta y, si falla, se registra en los logs del servidor (estado y código de
 *    Resend; nunca la clave ni el contenido del correo);
 *  · se devuelve `enviado` y el enlace, para que el negocio pueda compartirlo a mano si el correo
 *    no salió (aceptarla exige ingresar con ESE correo: la invitación la protege la base);
 *  · el nombre del negocio y el correo se escapan antes de ponerlos en el HTML.
 */
function escaparHtml(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function origen() {
  const definido = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (definido) return definido;
  const h = await headers();
  const host = h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : "https://app.stylernow.com";
}

export async function enviarInvitacionStaff(
  email: string,
  nombreNegocio: string,
  invitacionId: string
): Promise<{ enviado: boolean; enlace: string }> {
  const enlace = `${await origen()}/invitacion/${invitacionId}`;
  const token = process.env.RESEND_API_KEY?.trim();
  if (!token) {
    console.error("[invitacion-staff] RESEND_API_KEY no configurada: el correo no se envió", invitacionId);
    return { enviado: false, enlace };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: REMITENTE_CORREO,
        to: email,
        subject: `Te invitaron a unirte a ${nombreNegocio.replace(/[\r\n]+/g, " ").slice(0, 120)} en StylerNow`,
        html: `<h2>Te invitaron a StylerNow</h2><p>${escaparHtml(nombreNegocio)} te invitó a unirte como Staff. Ingresa con este mismo correo (${escaparHtml(email)}) y <a href="${enlace}">acepta o rechaza la invitación aquí</a>.</p>`,
      }),
    });
    if (!r.ok) {
      const cuerpo = (await r.text().catch(() => "")).slice(0, 300);
      console.error("[invitacion-staff] Resend rechazó el envío", r.status, cuerpo, invitacionId);
      return { enviado: false, enlace };
    }
    return { enviado: true, enlace };
  } catch (e) {
    console.error("[invitacion-staff] no se pudo contactar a Resend", e instanceof Error ? e.message : e, invitacionId);
    return { enviado: false, enlace };
  }
}
