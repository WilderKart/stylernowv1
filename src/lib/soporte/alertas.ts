import "server-only";
import { seleccionarAdaptador } from "@/lib/notificaciones/adaptadores";
import { enviarAlertaOperativa } from "@/lib/observabilidad/alertas";
import { createAdminClient } from "@/lib/supabase/admin";

export type DatosAlertaSoporte = {
  negocioId: string;
  conversacionId: string;
  mensajeId: string;
  remitenteRol: "BARBERIA" | "SUPERSU";
  alertaWebhook: boolean;
  alertaEmailAdmin: boolean;
  alertaEmailNegocio: boolean;
  prioritario?: boolean;
  tieneAdjunto?: boolean;
};

/**
 * Origen público de la app para los enlaces de los correos. Un enlace relativo (`/admin/soporte`) en un correo no lleva a ningún
 * sitio: el cliente de correo lo convierte en `http:///admin/soporte`. Se corre en `after()`, sin cabeceras de la petición, así que
 * se usa la variable de entorno y, si falta o no es https, el dominio de producción.
 */
function origenPublico(): string {
  const definido = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return definido && /^https:\/\//.test(definido) ? definido : "https://app.stylernow.com";
}

/** Enlace absoluto a una ruta de la app. Si la persona no tiene sesión, el proxy la lleva a /login y, al entrar, de vuelta a esta ruta. */
export function enlaceAbsoluto(ruta: string): string {
  return `${origenPublico()}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}

async function enviarCorreo(params: {
  id: string;
  email: string;
  asunto: string;
  ruta: string;
  destinatario: string;
}) {
  const adaptador = seleccionarAdaptador("EMAIL");
  if (!adaptador.habilitado) return;
  const enlace = enlaceAbsoluto(params.ruta);
  const texto = `Hola ${params.destinatario}, tienes una novedad en el chat de soporte de StylerNow. Ábrela aquí: ${enlace}. Por privacidad, el mensaje no se incluye en este correo.`;
  await adaptador.enviar({
    id: params.id,
    canal: "EMAIL",
    idioma: "es",
    asunto: params.asunto,
    texto,
    html: `<p>Hola ${params.destinatario},</p><p>Tienes una novedad en el chat de soporte de StylerNow. Ingresa a la plataforma para leerla.</p><p>Por privacidad, el mensaje no se incluye en este correo.</p><p><a href="${enlace}">Abrir soporte</a></p>`,
    ruta: enlace,
    email: params.email,
  });
}

export async function procesarAlertasSoporte(datos: DatosAlertaSoporte): Promise<void> {
  const esBarberia = datos.remitenteRol === "BARBERIA";

  if (datos.alertaWebhook) {
    // Contexto para quien atiende desde el webhook interno: negocio, plan y extracto (el correo, en cambio, nunca lleva el texto).
    let contexto: { negocio?: string; plan?: string; extracto?: string } = {};
    try {
      const admin = createAdminClient();
      const [{ data: neg }, { data: msg }] = await Promise.all([
        admin.from("negocio").select("nombre, plan_codigo").eq("id", datos.negocioId).maybeSingle(),
        admin.from("soporte_mensaje").select("cuerpo, adjunto_tipo").eq("id", datos.mensajeId).maybeSingle(),
      ]);
      contexto = {
        negocio: neg?.nombre,
        plan: neg?.plan_codigo ?? undefined,
        extracto: msg ? (msg.cuerpo.trim() ? msg.cuerpo.trim().slice(0, 140) : msg.adjunto_tipo === "PDF" ? "📄 PDF" : "📷 Imagen") : undefined,
      };
    } catch {
      contexto = {};
    }
    await enviarAlertaOperativa({
      tipo: "SOPORTE",
      titulo: esBarberia ? `${datos.prioritario ? "[PRIORITARIO] " : ""}Nuevo mensaje de soporte` : "Nueva respuesta de soporte",
      detalle: {
        conversacion_id: datos.conversacionId,
        negocio_id: datos.negocioId,
        mensaje_id: datos.mensajeId,
        remitente_rol: datos.remitenteRol,
        ...contexto,
        prioritario: datos.prioritario ?? false,
        con_adjunto: datos.tieneAdjunto ?? false,
        enlace: enlaceAbsoluto(`/admin/soporte?c=${datos.conversacionId}`),
      },
      severidad: "info",
    });
  }

  if (!datos.alertaEmailAdmin && !datos.alertaEmailNegocio) return;

  const supabase = createAdminClient();
  const correos: Promise<void>[] = [];

  if (datos.alertaEmailAdmin) {
    const { data: perfil } = await supabase
      .from("perfil")
      .select("email, nombre")
      .eq("es_supersu", true)
      .limit(1)
      .maybeSingle();
    if (perfil?.email) {
      correos.push(
        enviarCorreo({
          id: `${datos.mensajeId}-admin`,
          email: perfil.email,
          asunto: "Nuevo mensaje en el chat de soporte",
          ruta: `/admin/soporte?c=${datos.conversacionId}`,
          destinatario: perfil.nombre || "SuperSU",
        }),
      );
    }
  }

  if (datos.alertaEmailNegocio) {
    const { data: negocio } = await supabase
      .from("negocio")
      .select("owner_user_id")
      .eq("id", datos.negocioId)
      .maybeSingle();
    if (negocio?.owner_user_id) {
      const { data: perfil } = await supabase
        .from("perfil")
        .select("email, nombre")
        .eq("id", negocio.owner_user_id)
        .maybeSingle();
      if (perfil?.email) {
        correos.push(
          enviarCorreo({
            id: `${datos.mensajeId}-negocio`,
            email: perfil.email,
            asunto: "Nueva respuesta en el chat de soporte",
            ruta: "/panel/soporte",
            destinatario: perfil.nombre || "Bienvenido",
          }),
        );
      }
    }
  }

  await Promise.all(correos);
}
