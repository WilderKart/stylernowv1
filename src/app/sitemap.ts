import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

const SITIO = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://stylernowv1.vercel.app").replace(/\/$/, "");

// Se regenera cada hora; los negocios nuevos aparecen sin redesplegar.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: `${SITIO}/`, lastModified: ahora, changeFrequency: "daily", priority: 1 },
    { url: `${SITIO}/para-negocios`, lastModified: ahora, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITIO}/legal/terminos`, lastModified: ahora, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITIO}/legal/politica-de-datos`, lastModified: ahora, changeFrequency: "yearly", priority: 0.2 },
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return base;

  try {
    // Cliente anónimo sin sesión: solo ve negocios ACTIVOS por RLS (los mismos que muestra el marketplace).
    const supabase = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await supabase.from("negocio").select("slug, updated_at").eq("estado", "ACTIVO").limit(5000);
    const negocios: MetadataRoute.Sitemap = (data ?? []).map((n) => ({
      url: `${SITIO}/negocio/${n.slug}`,
      lastModified: n.updated_at ? new Date(n.updated_at) : ahora,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
    return [...base, ...negocios];
  } catch {
    return base;
  }
}
