"use server";

import type { NegocioTarjeta } from "@/components/marketplace/negocio-card";
import { createClient } from "@/lib/supabase/server";

export type ResultadoFavoritos = { ok: true; negocios: NegocioTarjeta[] } | { ok: false; error: string };

export async function listarMisFavoritos(): Promise<ResultadoFavoritos> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true, negocios: [] };

  const { data: favoritos, error } = await supabase
    .from("favorito_negocio")
    .select("negocio_id, created_at, negocio:negocio_id (id, nombre, slug, ciudad, categoria, logo_url, foto_principal_url, estado)")
    .eq("cliente_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  // Un fallo real no debe verse como "no tienes favoritos".
  if (error) return { ok: false, error: "FAVORITOS_NO_DISPONIBLES" };

  const negocios = (favoritos ?? [])
    .map((f) => f.negocio as unknown as { id: string; nombre: string; slug: string; ciudad: string; categoria: string[]; logo_url: string | null; foto_principal_url: string | null; estado: string } | null)
    .filter((n): n is NonNullable<typeof n> => Boolean(n) && n!.estado === "ACTIVO");

  if (negocios.length === 0) return { ok: true, negocios: [] };

  // Dos consultas en lote (antes eran 2 por favorito) y con tope.
  const ids = negocios.map((n) => n.id);
  const [{ data: resenas }, { data: servicios }] = await Promise.all([
    supabase.from("resena").select("negocio_id, calificacion").in("negocio_id", ids).eq("estado", "VISIBLE").limit(5000),
    supabase.from("servicio").select("negocio_id, precio_base").in("negocio_id", ids).eq("estado", "ACTIVO").order("precio_base").limit(2000),
  ]);
  const sumas = new Map<string, { suma: number; total: number }>();
  for (const r of resenas ?? []) {
    const a = sumas.get(r.negocio_id) ?? { suma: 0, total: 0 };
    a.suma += r.calificacion;
    a.total += 1;
    sumas.set(r.negocio_id, a);
  }
  const minimos = new Map<string, number>();
  for (const sv of servicios ?? []) if (!minimos.has(sv.negocio_id)) minimos.set(sv.negocio_id, sv.precio_base);

  return {
    ok: true,
    negocios: negocios.map((n) => {
      const a = sumas.get(n.id);
      return {
        id: n.id,
        nombre: n.nombre,
        slug: n.slug,
        ciudad: n.ciudad,
        categoria: n.categoria,
        // Foto principal (fachada) primero; el logo es solo respaldo.
        logo_url: n.foto_principal_url ?? n.logo_url,
        calificacion: a && a.total > 0 ? a.suma / a.total : 0,
        total_resenas: a?.total ?? 0,
        precio_desde: minimos.get(n.id) ?? null,
        proxima_disponibilidad: null,
      };
    }),
  };
}
