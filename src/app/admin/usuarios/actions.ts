"use server";

import { requireSuperSU } from "@/lib/auth/require-supersu";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rpcAdmin } from "../_componentes/rpc";

type Resultado = { ok: true } | { ok: false; error: string };

const esquema = z.object({
  usuarioId: z.string().uuid(),
  motivo: z.string().trim().min(5, "Escribe un motivo (mínimo 5 caracteres).").max(300),
});

/**
 * Incrementa el session_version en el perfil para invalidar sesiones activas.
 * Usa el client de Supabase con service_role (ya tiene los permisos necesarios).
 */
async function incrementarSessionVersion(usuarioId: string) {
  const supabase = createAdminClient();
  try {
    const { error } = await supabase.rpc("incrementar_session_version", { p_user_id: usuarioId });
    if (error) throw error;
  } catch {
    // Si falla, no bloqueamos la operación (patrón consistente con login/actions.ts).
  }
}

/**
 * Acciones del Super Admin sobre una cuenta. Cero confianza: la sesión se verifica aquí (requireSuperSU) y la
 * base vuelve a verificar is_supersu(), bloquea actuar sobre uno mismo o sobre el Super Admin, revoca las
 * sesiones en Auth y deja el registro en auditoría (migración 137). La suspensión real la aplica Auth (ban).
 * Además, incrementa session_version para invalidar sesiones activas inmediatamente.
 */
async function aplicar(
  accion: "USUARIO_SUSPENDIDO" | "USUARIO_REACTIVADO" | "USUARIO_SESIONES_CERRADAS",
  entrada: { usuarioId: string; motivo: string },
): Promise<Resultado> {
  try {
    await requireSuperSU();
    const p = esquema.safeParse(entrada);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
    const { usuarioId, motivo } = p.data;

    // 1) Incrementar session_version para invalidar sesiones activas inmediatamente.
    await incrementarSessionVersion(usuarioId);

    // 2) Validación + auditoría + revocación de sesiones en la base (lanza si no corresponde).
    const r = await rpcAdmin<null>("admin_usuario_registrar_accion", { p_id: usuarioId, p_accion: accion, p_motivo: motivo });
    if (!r.ok) return r;

    // 3) Bloqueo / desbloqueo real de la cuenta en Supabase Auth.
    if (accion !== "USUARIO_SESIONES_CERRADAS") {
      const { error } = await createAdminClient().auth.admin.updateUserById(usuarioId, {
        ban_duration: accion === "USUARIO_SUSPENDIDO" ? "876000h" : "none",
      });
      if (error) return { ok: false, error: "Quedó registrado, pero Auth no aplicó el cambio. Intenta de nuevo." };
    }

    revalidatePath("/admin/usuarios");
    revalidatePath(`/admin/usuarios/${usuarioId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No pudimos completar la operación. Intenta de nuevo." };
  }
}

export async function suspenderUsuario(usuarioId: string, motivo: string) {
  return aplicar("USUARIO_SUSPENDIDO", { usuarioId, motivo });
}

export async function reactivarUsuario(usuarioId: string, motivo: string) {
  return aplicar("USUARIO_REACTIVADO", { usuarioId, motivo });
}

export async function cerrarSesionesUsuario(usuarioId: string, motivo: string) {
  return aplicar("USUARIO_SESIONES_CERRADAS", { usuarioId, motivo });
}