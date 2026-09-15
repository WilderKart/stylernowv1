"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function slugify(nombre: string) {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "negocio"
  );
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

// ── Paso 1 — Datos del negocio ─────────────────────────────────────────────

export async function crearOActualizarNegocio(datos: {
  negocioId: string | null;
  nombre: string;
  categoria: string[];
  ciudad: string;
  descripcion: string;
  telefonoContacto: string;
  emailContacto: string;
}): Promise<Resultado<{ id: string }>> {
  try {
    const { supabase, userId } = await usuarioActual();

    if (datos.categoria.length === 0) {
      return { ok: false, error: "Elegí al menos una categoría." };
    }

    if (datos.negocioId) {
      const { error } = await supabase
        .from("negocio")
        .update({
          nombre: datos.nombre,
          categoria: datos.categoria,
          ciudad: datos.ciudad,
          descripcion: datos.descripcion || null,
          telefono_contacto: datos.telefonoContacto || null,
          email_contacto: datos.emailContacto || null,
        })
        .eq("id", datos.negocioId)
        .eq("owner_user_id", userId);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/panel/onboarding");
      return { ok: true, data: { id: datos.negocioId } };
    }

    // Slug único: nombre + sufijo corto del owner, con reintento simple si
    // por casualidad ya existe (negocio.slug es unique).
    //
    // El `id` se genera acá, no se deja al DEFAULT de la columna: pedirle a
    // Postgres el registro recién insertado (.select()) exige que la política
    // de SELECT lo autorice, y esa política depende de is_barberia_de(), que
    // vuelve a consultar la MISMA fila que se está insertando — en el mismo
    // comando INSERT ... RETURNING eso falla con "new row violates row-level
    // security policy" incluso con una política trivial `true` (verificado
    // directo contra Postgres). Generando el id acá evitamos pedir RETURNING.
    const base = slugify(datos.nombre);
    let slug = base;
    for (let intento = 0; intento < 5; intento++) {
      const id = crypto.randomUUID();
      const { error } = await supabase.from("negocio").insert({
        id,
        owner_user_id: userId,
        nombre: datos.nombre,
        slug,
        categoria: datos.categoria,
        ciudad: datos.ciudad,
        descripcion: datos.descripcion || null,
        telefono_contacto: datos.telefonoContacto || null,
        email_contacto: datos.emailContacto || null,
      });

      if (!error) {
        revalidatePath("/panel/onboarding");
        return { ok: true, data: { id } };
      }
      if (error.code === "23505") {
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo generar un identificador único, reintentá." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function subirLogo(negocioId: string, dataUrl: string): Promise<Resultado<{ url: string }>> {
  try {
    const { supabase, userId } = await usuarioActual();

    const { data: negocio } = await supabase
      .from("negocio")
      .select("id")
      .eq("id", negocioId)
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!negocio) return { ok: false, error: "No autorizado." };

    const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
    if (!match) return { ok: false, error: "Imagen inválida." };
    const [, mime, base64] = match;
    const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) {
      return { ok: false, error: "La imagen no puede superar 5 MB." };
    }

    const ruta = `${negocioId}/logo.${ext}`;
    const { error: eUpload } = await supabase.storage
      .from("negocio-media")
      .upload(ruta, bytes, { contentType: mime, upsert: true });
    if (eUpload) return { ok: false, error: eUpload.message };

    const { data: pub } = supabase.storage.from("negocio-media").getPublicUrl(ruta);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    await supabase.from("negocio").update({ logo_url: url }).eq("id", negocioId);
    revalidatePath("/panel/onboarding");
    return { ok: true, data: { url } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function elegirPlan(
  negocioId: string,
  planCodigo: "RAVEN" | "JARL" | "VALHALLA"
): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("crear_suscripcion_inicial", {
      p_negocio_id: negocioId,
      p_plan_codigo: planCodigo,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/onboarding");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Paso 2 — Sede ───────────────────────────────────────────────────────────

export interface HorarioDia {
  abierto: boolean;
  inicio: string;
  fin: string;
}
export type HorarioSemana = Record<
  "dom" | "lun" | "mar" | "mie" | "jue" | "vie" | "sab",
  HorarioDia
>;

export async function guardarSede(datos: {
  sedeId: string | null;
  negocioId: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  horario: HorarioSemana;
  latitud: number | null;
  longitud: number | null;
}): Promise<Resultado<{ id: string }>> {
  try {
    const { supabase } = await usuarioActual();

    const horarioBase = Object.fromEntries(
      Object.entries(datos.horario)
        .filter(([, d]) => d.abierto)
        .map(([dia, d]) => [dia, [[d.inicio, d.fin]]])
    );

    const payload = {
      negocio_id: datos.negocioId,
      nombre: datos.nombre,
      direccion: datos.direccion,
      ciudad: datos.ciudad,
      horario_base: horarioBase,
      latitud: datos.latitud,
      longitud: datos.longitud,
    };

    if (datos.sedeId) {
      const { error } = await supabase.from("sede").update(payload).eq("id", datos.sedeId);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/panel/onboarding");
      return { ok: true, data: { id: datos.sedeId } };
    }

    const { data, error } = await supabase.from("sede").insert(payload).select("id").single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/onboarding");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Paso 3 — Servicios ──────────────────────────────────────────────────────

export async function crearServicio(datos: {
  negocioId: string;
  nombre: string;
  duracionMinutos: number;
  precioBase: number;
  descripcion: string;
}): Promise<Resultado<{ id: string }>> {
  try {
    const { supabase } = await usuarioActual();

    if (datos.duracionMinutos <= 0) return { ok: false, error: "La duración debe ser mayor a 0." };
    if (datos.precioBase < 0) return { ok: false, error: "El precio no puede ser negativo." };

    const { data, error } = await supabase
      .from("servicio")
      .insert({
        negocio_id: datos.negocioId,
        nombre: datos.nombre,
        duracion_minutos: datos.duracionMinutos,
        precio_base: datos.precioBase,
        descripcion: datos.descripcion || null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/onboarding");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function eliminarServicio(servicioId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    // Soft delete (03-Business-Rules/02_Booking_Rules.md): nunca borrado físico,
    // por si ya hay una Reserva futura referenciándolo.
    const { error } = await supabase
      .from("servicio")
      .update({ estado: "INACTIVO" })
      .eq("id", servicioId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/onboarding");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Paso 4 — Invitar Staff (opcional) ───────────────────────────────────────

export async function invitarStaff(negocioId: string, email: string): Promise<Resultado> {
  try {
    const { supabase, userId } = await usuarioActual();
    const correo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return { ok: false, error: "Ese correo no parece válido." };
    }

    const { error } = await supabase
      .from("invitacion_staff")
      .insert({ negocio_id: negocioId, email: correo, invitado_por: userId });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya invitaste a ese correo." };
      return { ok: false, error: error.message };
    }

    // TODO(Módulo 2.4): pantalla de aceptación en /invitacion/[id] que cree el
    // vinculo_staff_negocio real cuando la persona invitada inicia sesión con
    // este mismo correo. Por ahora la invitación queda registrada y notificada;
    // la vinculación efectiva se completa en Gestión de Staff.
    const { data: negocio } = await supabase.from("negocio").select("nombre").eq("id", negocioId).single();
    await notificarInvitacion(correo, negocio?.nombre ?? "un negocio en StylerNow");

    revalidatePath("/panel/onboarding");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

async function notificarInvitacion(email: string, nombreNegocio: string) {
  const token = process.env.RESEND_API_KEY;
  if (!token) return; // No bloquea el onboarding si falta la key en este entorno.

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "StylerNow <notificaciones@mail.stylernow.com>",
        to: email,
        subject: `Te invitaron a unirte a ${nombreNegocio} en StylerNow`,
        html: `<h2>Te invitaron a StylerNow</h2><p>${nombreNegocio} te invitó a unirte como Staff. Ingresá a <a href="https://stylernow.com">StylerNow</a> con este mismo correo (${email}) para completar tu perfil.</p>`,
      }),
    });
  } catch {
    // El registro de la invitación ya quedó guardado; el correo es un mejor-esfuerzo.
  }
}

export async function cancelarInvitacion(invitacionId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.from("invitacion_staff").delete().eq("id", invitacionId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/onboarding");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Envío a aprobación ───────────────────────────────────────────────────────

export async function enviarAAprobacion(negocioId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("enviar_negocio_a_aprobacion", {
      p_negocio_id: negocioId,
    });
    if (error) {
      const mensajes: Record<string, string> = {
        FALTA_SEDE: "Agregá al menos una Sede antes de enviar a aprobación.",
        FALTA_SERVICIO: "Agregá al menos un Servicio antes de enviar a aprobación.",
        FALTA_PLAN: "Elegí un Plan antes de enviar a aprobación.",
        NO_AUTORIZADO: "No tenés permiso sobre este negocio.",
      };
      const clave = Object.keys(mensajes).find((k) => error.message.includes(k));
      return { ok: false, error: clave ? mensajes[clave] : error.message };
    }
    revalidatePath("/panel");
    revalidatePath("/panel/onboarding");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
