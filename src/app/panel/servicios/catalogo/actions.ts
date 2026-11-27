"use server";

import { MENSAJE_RESTRINGIDA } from "@/lib/suscripcion/estado-operativo";
import { CATALOGO_SERVICIOS, categoriaDe } from "@/lib/servicios/catalogo";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ResultadoCatalogo = { ok: true; servicioId: string } | { ok: false; error: string };

const MENSAJES: Array<[string, string]> = [
  ["SUSCRIPCION_RESTRINGIDA", MENSAJE_RESTRINGIDA],
  ["SERVICIO_YA_AGREGADO", "Ese servicio ya está en tu menú."],
  ["ELIGE_AL_MENOS_UNA_SEDE", "Elige al menos una sede donde lo ofreces."],
  ["DURACION_INVALIDA", "La duración debe estar entre 5 y 480 minutos."],
  ["PRECIO_INVALIDO", "Escribe un precio válido."],
  ["PROFESIONAL_INVALIDO", "Uno de los profesionales ya no está disponible."],
  ["SEDE_INVALIDA", "Una de las sedes no es de tu negocio."],
  ["NO_AUTORIZADO", "Solo el propietario puede agregar servicios."],
  ["PLAN_LIMIT_EXCEEDED", "Tu plan alcanzó el máximo de servicios."],
];

/**
 * Agrega al menú del negocio un servicio del catálogo de StylerNow. El navegador solo envía la CLAVE del catálogo: nombre, imagen y
 * categoría salen del catálogo en el servidor, y la base vuelve a validar propietario, sedes, equipo y precio (migración 202).
 */
export async function agregarDesdeCatalogo(entrada: {
  negocioId: string;
  catalogoId: string;
  precio: number;
  duracion: number;
  descripcion?: string;
  sedes: string[];
  staff: string[];
}): Promise<ResultadoCatalogo> {
  const p = z
    .object({
      negocioId: z.string().uuid(),
      catalogoId: z.string().min(3).max(160),
      precio: z.number().finite().min(0).max(100000000),
      duracion: z.number().int().min(5).max(480),
      descripcion: z.string().trim().max(300).optional(),
      sedes: z.array(z.string().uuid()).min(1).max(50),
      staff: z.array(z.string().uuid()).max(200),
    })
    .safeParse(entrada);
  if (!p.success) return { ok: false, error: "Revisa el precio, la duración y las sedes." };

  const item = CATALOGO_SERVICIOS.find((s) => s.id === p.data.catalogoId);
  if (!item) return { ok: false, error: "Ese servicio no está en el catálogo." };

  try {
    const supabase = (await createClient()) as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { data, error } = await supabase.rpc("servicio_crear_desde_catalogo", {
      p_negocio: p.data.negocioId,
      p_catalogo_ref: item.id,
      p_nombre: item.nombre,
      p_imagen_url: item.imagen,
      p_categoria: categoriaDe(item.categoria).categoriaPuntaje,
      p_duracion: p.data.duracion,
      p_precio: p.data.precio,
      p_descripcion: p.data.descripcion ?? null,
      p_sedes: p.data.sedes,
      p_staff: p.data.staff,
    });
    if (error) return { ok: false, error: MENSAJES.find(([c]) => error.message.includes(c))?.[1] ?? "No pudimos agregar el servicio. Intenta de nuevo." };
    revalidatePath("/panel/servicios");
    revalidatePath("/panel/onboarding");
    return { ok: true, servicioId: data as unknown as string };
  } catch {
    return { ok: false, error: "No pudimos agregar el servicio. Intenta de nuevo." };
  }
}
