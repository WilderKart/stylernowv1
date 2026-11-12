import type { MetadataRoute } from "next";

const SITIO = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://stylernowv1.vercel.app").replace(/\/$/, "");

/** Solo se indexa lo público (home, fichas de negocio, para-negocios, legal). Lo privado y los paneles quedan fuera. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/negocio/", "/para-negocios", "/legal/"],
        disallow: [
          "/api/", "/panel", "/admin", "/staff", "/login", "/auth", "/reserva/", "/perfil", "/mis-reservas", "/pagos",
          "/lealtad", "/referidos", "/mi-look", "/notificaciones", "/ajustes", "/cuenta", "/privacidad", "/checkout", "/onboarding",
          "/gift-cards", "/membresias", "/favoritos", "/invitacion", "/mantenimiento",
        ],
      },
    ],
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
