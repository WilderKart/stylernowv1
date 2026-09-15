"use server";

import { registrarAceptacionLegal } from "@/lib/auth/aceptacion-legal";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * Dominio de la request actual, no un valor fijo de env: Vercel sirve este proyecto
 * bajo más de un alias (el corto y el largo con el hash del team), y el link del
 * correo tiene que volver exactamente por donde entró el usuario. Cualquier alias
 * que se use acá debe estar en Supabase → Authentication → URL Configuration →
 * Redirect URLs, si no Supabase rechaza el `emailRedirectTo`.
 */
async function origenActual() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function enviarCodigo(email: string, siguiente: string, aceptaTerminos: boolean) {
  // Zero-trust: el checkbox del formulario es solo la primera barrera. Sin esta
  // validación acá, cualquiera podía llamar a esta action directo (sin pasar por
  // la UI) y saltarse el consentimiento exigido por 06-Security/04_Compliance_
  // Colombia.md.
  if (!aceptaTerminos) {
    return {
      ok: false as const,
      error: "Debés aceptar los Términos y la Política de Tratamiento de Datos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // El link "Iniciar sesión" del correo vuelve acá en vez de a la home directo,
      // para que el intercambio de código realmente cree la sesión (src/app/auth/callback).
      emailRedirectTo: `${await origenActual()}/auth/callback?next=${encodeURIComponent(siguiente)}`,
    },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function verificarCodigo(email: string, token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ok: false as const, error: error.message };

  let faltaTelefono = false;
  let pendientesLegales: { id: string; tipo: string }[] = [];

  if (data.user) {
    const { pendientesMateriales } = await registrarAceptacionLegal(supabase, data.user.id);
    pendientesLegales = pendientesMateriales.map((t) => ({ id: t.id, tipo: t.tipo }));

    // 06-Security/04_Compliance_Colombia.md: registrar timestamp de aceptación del
    // consentimiento (el checkbox ya fue exigido en el paso anterior del formulario).
    await supabase
      .from("perfil")
      .update({ consentimiento_datos_at: new Date().toISOString() })
      .eq("id", data.user.id)
      .is("consentimiento_datos_at", null);

    // handle_new_user() (migración 007) crea el perfil con el prefijo del email como
    // nombre provisorio y sin teléfono. Se usa "sin teléfono" como señal de que es el
    // primer login, para pedirle una sola vez sus datos reales (02-UX/02_Onboarding.md).
    const { data: perfil } = await supabase
      .from("perfil")
      .select("telefono")
      .eq("id", data.user.id)
      .single();
    faltaTelefono = !perfil?.telefono;
  }

  return { ok: true as const, faltaTelefono, pendientesLegales };
}
