"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export async function esFavorito(negocioId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("favorito_negocio")
    .select("negocio_id")
    .eq("cliente_id", user.id)
    .eq("negocio_id", negocioId)
    .maybeSingle();
  return Boolean(data);
}

export async function alternarFavorito(negocioId: string, slug: string): Promise<Resultado<{ favorito: boolean }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Iniciá sesión para guardar favoritos." };

    const { data: existente } = await supabase
      .from("favorito_negocio")
      .select("negocio_id")
      .eq("cliente_id", user.id)
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (existente) {
      const { error } = await supabase.from("favorito_negocio").delete().eq("cliente_id", user.id).eq("negocio_id", negocioId);
      if (error) return { ok: false, error: error.message };
      revalidatePath(`/negocio/${slug}`);
      revalidatePath("/favoritos");
      return { ok: true, data: { favorito: false } };
    }

    const { error } = await supabase.from("favorito_negocio").insert({ cliente_id: user.id, negocio_id: negocioId });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/negocio/${slug}`);
    revalidatePath("/favoritos");
    return { ok: true, data: { favorito: true } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
