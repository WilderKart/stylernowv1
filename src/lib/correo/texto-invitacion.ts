import type { RolAsignable } from "@/lib/auth/roles-equipo";

/** Texto del correo de invitación al equipo. Puro (sin servidor) para poder probarlo: el correo debe decir con QUÉ ROL se invita. */

function escaparHtml(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const COMO: Record<RolAsignable, { frase: string; detalle: string }> = {
  BARBER: {
    frase: "como profesional",
    detalle: "Atenderás clientes y tendrás tu propia agenda.",
  },
  BUSINESS_ADMIN: {
    frase: "como administrador",
    detalle: "Ayudarás a administrar el equipo del negocio. No atenderás clientes ni aparecerás en la agenda pública.",
  },
  ADMIN_BARBER: {
    frase: "como administrador y profesional",
    detalle: "Ayudarás a administrar el equipo y además atenderás clientes con tu propia agenda.",
  },
};

export function textoInvitacion(rol: RolAsignable, nombreNegocio: string, email: string, enlace: string): { asunto: string; html: string } {
  const c = COMO[rol] ?? COMO.BARBER;
  const negocio = nombreNegocio.replace(/[\r\n]+/g, " ").slice(0, 120);
  return {
    asunto: `Te invitaron a unirte a ${negocio} en StylerNow ${c.frase}`,
    html:
      `<h2>Te invitaron a StylerNow</h2>` +
      `<p>${escaparHtml(nombreNegocio)} te invitó a unirte ${c.frase}. ${c.detalle}</p>` +
      `<p>Ingresa con este mismo correo (${escaparHtml(email)}) y <a href="${enlace}">acepta o rechaza la invitación aquí</a>.</p>`,
  };
}
