"use server";

import { createClient } from "@/lib/supabase/server";

export async function enviarCodigo(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function verificarCodigo(email: string, token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ok: false as const, error: error.message };

  // 06-Security/04_Compliance_Colombia.md: registrar timestamp de aceptación del
  // consentimiento (el checkbox ya fue exigido en el paso anterior del formulario).
  if (data.user) {
    await supabase
      .from("perfil")
      .update({ consentimiento_datos_at: new Date().toISOString() })
      .eq("id", data.user.id)
      .is("consentimiento_datos_at", null);
  }

  return { ok: true as const };
}
