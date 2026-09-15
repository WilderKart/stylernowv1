"use server";

import type { NegocioTarjeta } from "@/components/marketplace/negocio-card";
import { createClient } from "@/lib/supabase/server";

export async function listarMisFavoritos(): Promise<NegocioTarjeta[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: favoritos } = await supabase
    .from("favorito_negocio")
    .select("negocio_id, created_at, negocio:negocio_id (id, nombre, slug, ciudad, categoria, logo_url, estado)")
    .eq("cliente_id", user.id)
    .order("created_at", { ascending: false });

  const negocios = (favoritos ?? [])
    .map((f) => f.negocio as unknown as { id: string; nombre: string; slug: string; ciudad: string; categoria: string[]; logo_url: string | null; estado: string } | null)
    .filter((n): n is NonNullable<typeof n> => Boolean(n) && n!.estado === "ACTIVO");

  if (negocios.length === 0) return [];

  const resultados = await Promise.all(
    negocios.map(async (n) => {
      const [{ data: resenas }, { data: servicios }] = await Promise.all([
        supabase.from("resena").select("calificacion").eq("negocio_id", n.id).eq("estado", "VISIBLE"),
        supabase.from("servicio").select("precio_base").eq("negocio_id", n.id).eq("estado", "ACTIVO").order("precio_base").limit(1),
      ]);
      const calificaciones = (resenas ?? []).map((r) => r.calificacion);
      const calificacion = calificaciones.length > 0 ? calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length : 0;
      return {
        id: n.id,
        nombre: n.nombre,
        slug: n.slug,
        ciudad: n.ciudad,
        categoria: n.categoria,
        logo_url: n.logo_url,
        calificacion,
        total_resenas: calificaciones.length,
        precio_desde: servicios?.[0]?.precio_base ?? null,
        proxima_disponibilidad: null,
      };
    })
  );

  return resultados;
}
