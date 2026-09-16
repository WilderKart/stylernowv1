"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

// VIP dinámico por LTV — 07_CRM.md da $500.000 como EJEMPLO de regla, no
// como umbral fijo de plataforma. Se adopta ese mismo número acá, nunca
// guardado (se recalcula en cada lectura, así nunca queda "pegado" tras
// un reembolso que baje el LTV — caso límite explícito de la Biblia).
const UMBRAL_VIP = 500000;

// ── Listado con búsqueda/filtro/orden/paginación ────────────────────────

export interface ClienteCRM {
  clienteId: string;
  nombre: string;
  fotoUrl: string | null;
  telefono: string | null;
  visitas: number;
  ultimaVisita: string | null;
  ltv: number;
  etiquetas: string[];
  esVip: boolean;
}

export interface FiltroCRM {
  negocioId: string;
  sedeId?: string | null;
  busqueda?: string;
  etiqueta?: string;
  ltvMin?: number;
  ltvMax?: number;
  ultimaVisitaDespues?: string;
  ultimaVisitaAntes?: string;
  primeraVisitaDespues?: string;
  primeraVisitaAntes?: string;
  soloVip?: boolean;
  /** 01_CRM_Complete.md: todo segmento pensado para exportar a campaña
   * excluye automáticamente a quien retiró su consentimiento de
   * marketing — no es una opción, es un filtro obligatorio. */
  soloConConsentimientoMarketing?: boolean;
  orden?: "nombre" | "visitas_desc" | "ltv_desc" | "ultima_visita_desc";
  offset?: number;
  limite?: number;
}

export async function listarClientesCRM(filtro: FiltroCRM): Promise<Resultado<{ items: ClienteCRM[]; total: number }>> {
  try {
    const { supabase } = await usuarioActual();

    // Todos los filtros que no son columnas directas de vista_crm_cliente
    // (sede, etiqueta, consentimiento de marketing) se resuelven ANTES,
    // como listas de cliente_id, e intersecan entre sí — así la
    // paginación (.range()) sigue siendo correcta: nunca se filtra
    // después de haber cortado la página, que dejaría páginas vacías con
    // resultados reales más adelante.
    const listasAIntersecar: string[][] = [];

    if (filtro.sedeId) {
      const { data: reservasSede } = await supabase
        .from("reserva")
        .select("cliente_id")
        .eq("negocio_id", filtro.negocioId)
        .eq("sede_id", filtro.sedeId);
      listasAIntersecar.push([...new Set((reservasSede ?? []).map((r) => r.cliente_id))]);
    }
    if (filtro.etiqueta) {
      const { data: conEtiqueta } = await supabase
        .from("cliente_etiqueta")
        .select("cliente_id")
        .eq("negocio_id", filtro.negocioId)
        .eq("etiqueta", filtro.etiqueta);
      listasAIntersecar.push([...new Set((conEtiqueta ?? []).map((e) => e.cliente_id))]);
    }
    if (filtro.soloConConsentimientoMarketing) {
      const { data: conConsentimiento } = await supabase.from("perfil").select("id").eq("consentimiento_marketing", true);
      listasAIntersecar.push([...new Set((conConsentimiento ?? []).map((p) => p.id))]);
    }

    const idsPermitidos: string[] | null =
      listasAIntersecar.length === 0
        ? null
        : listasAIntersecar.reduce((acc, lista) => acc.filter((id) => lista.includes(id)));
    if (idsPermitidos !== null && idsPermitidos.length === 0) {
      return { ok: true, data: { items: [], total: 0 } };
    }

    let q = supabase.from("vista_crm_cliente").select("*", { count: "exact" }).eq("negocio_id", filtro.negocioId);
    if (idsPermitidos) q = q.in("cliente_id", idsPermitidos);
    if (filtro.busqueda?.trim()) {
      const b = filtro.busqueda.trim().replace(/[%_,()]/g, " ").trim();
      if (b) q = q.or(`cliente_nombre.ilike.%${b}%,cliente_telefono.ilike.%${b}%`);
    }
    if (filtro.ltvMin != null || filtro.soloVip) q = q.gte("ltv", Math.max(filtro.ltvMin ?? 0, filtro.soloVip ? UMBRAL_VIP : 0));
    if (filtro.ltvMax != null) q = q.lte("ltv", filtro.ltvMax);
    if (filtro.ultimaVisitaDespues) q = q.gte("ultima_visita", filtro.ultimaVisitaDespues);
    if (filtro.ultimaVisitaAntes) q = q.lte("ultima_visita", filtro.ultimaVisitaAntes);
    if (filtro.primeraVisitaDespues) q = q.gte("primera_visita", filtro.primeraVisitaDespues);
    if (filtro.primeraVisitaAntes) q = q.lte("primera_visita", filtro.primeraVisitaAntes);

    switch (filtro.orden ?? "nombre") {
      case "visitas_desc":
        q = q.order("visitas", { ascending: false });
        break;
      case "ltv_desc":
        q = q.order("ltv", { ascending: false });
        break;
      case "ultima_visita_desc":
        q = q.order("ultima_visita", { ascending: false, nullsFirst: false });
        break;
      default:
        q = q.order("cliente_nombre", { ascending: true });
    }

    const offset = filtro.offset ?? 0;
    const limite = filtro.limite ?? 20;
    q = q.range(offset, offset + limite - 1);

    const { data, error, count } = await q;
    if (error) return { ok: false, error: error.message };

    const clienteIds = (data ?? []).map((r) => r.cliente_id!);
    const { data: etiquetasData } = clienteIds.length
      ? await supabase.from("cliente_etiqueta").select("cliente_id, etiqueta").eq("negocio_id", filtro.negocioId).in("cliente_id", clienteIds)
      : { data: [] as { cliente_id: string; etiqueta: string }[] };
    const etiquetasPorCliente = new Map<string, string[]>();
    for (const e of etiquetasData ?? []) {
      const arr = etiquetasPorCliente.get(e.cliente_id) ?? [];
      arr.push(e.etiqueta);
      etiquetasPorCliente.set(e.cliente_id, arr);
    }

    const items: ClienteCRM[] = (data ?? []).map((r) => ({
      clienteId: r.cliente_id!,
      nombre: r.cliente_nombre!,
      fotoUrl: r.cliente_foto_url,
      telefono: r.cliente_telefono,
      visitas: r.visitas!,
      ultimaVisita: r.ultima_visita,
      ltv: Number(r.ltv),
      etiquetas: etiquetasPorCliente.get(r.cliente_id!) ?? [],
      esVip: Number(r.ltv) >= UMBRAL_VIP,
    }));

    return { ok: true, data: { items, total: count ?? 0 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Plantilla de segmento "Cumpleañeros del mes" ────────────────────────
// `fecha_nacimiento` vive en `perfil`, no en `vista_crm_cliente` (que se
// arma desde `reserva`) — se resuelve aparte, intersecando con quienes ya
// tienen alguna Reserva en este Negocio (mismo aislamiento que el resto
// del CRM: nunca un Cliente que nunca visitó este negocio).

export async function listarCumpleanerosDelMes(negocioId: string, sedeId?: string | null): Promise<Resultado<ClienteCRM[]>> {
  try {
    const { supabase } = await usuarioActual();

    let clienteIds: string[];
    if (sedeId) {
      const { data } = await supabase.from("reserva").select("cliente_id").eq("negocio_id", negocioId).eq("sede_id", sedeId);
      clienteIds = [...new Set((data ?? []).map((r) => r.cliente_id))];
    } else {
      const { data } = await supabase.from("reserva").select("cliente_id").eq("negocio_id", negocioId);
      clienteIds = [...new Set((data ?? []).map((r) => r.cliente_id))];
    }
    if (clienteIds.length === 0) return { ok: true, data: [] };

    const mesActual = new Date().getUTCMonth() + 1;
    const { data: perfiles, error } = await supabase
      .from("perfil")
      .select("id, fecha_nacimiento")
      .in("id", clienteIds)
      .not("fecha_nacimiento", "is", null);
    if (error) return { ok: false, error: error.message };

    const idsDelMes = (perfiles ?? [])
      .filter((p) => p.fecha_nacimiento && Number(p.fecha_nacimiento.slice(5, 7)) === mesActual)
      .map((p) => p.id);
    if (idsDelMes.length === 0) return { ok: true, data: [] };

    const { data: vista } = await supabase.from("vista_crm_cliente").select("*").eq("negocio_id", negocioId).in("cliente_id", idsDelMes);
    return {
      ok: true,
      data: (vista ?? []).map((r) => ({
        clienteId: r.cliente_id!,
        nombre: r.cliente_nombre!,
        fotoUrl: r.cliente_foto_url,
        telefono: r.cliente_telefono,
        visitas: r.visitas!,
        ultimaVisita: r.ultima_visita,
        ltv: Number(r.ltv),
        etiquetas: [],
        esVip: Number(r.ltv) >= UMBRAL_VIP,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Detalle: resumen, historial, preferencias ───────────────────────────

export interface ResumenCliente {
  clienteId: string;
  nombre: string;
  fotoUrl: string | null;
  telefono: string | null;
  email: string | null;
  fechaNacimiento: string | null;
  visitas: number;
  ultimaVisita: string | null;
  ltv: number;
  esVip: boolean;
  puntosActuales: number;
  servicioFavorito: string | null;
  staffPreferido: string | null;
}

export async function obtenerResumenCliente(negocioId: string, clienteId: string): Promise<Resultado<ResumenCliente>> {
  try {
    const { supabase } = await usuarioActual();

    const [{ data: vista }, { data: perfil }, { data: puntos }, { data: reservas }] = await Promise.all([
      supabase.from("vista_crm_cliente").select("*").eq("negocio_id", negocioId).eq("cliente_id", clienteId).maybeSingle(),
      supabase.from("perfil").select("nombre, avatar_url, telefono, email, fecha_nacimiento").eq("id", clienteId).maybeSingle(),
      supabase
        .from("punto_fidelizacion")
        .select("cantidad_disponible")
        .eq("negocio_id", negocioId)
        .eq("cliente_id", clienteId)
        .gt("fecha_expiracion", new Date().toISOString()),
      supabase
        .from("reserva")
        .select("staff_id, reserva_servicio (servicio_id, servicio:servicio_id (nombre)), staff:staff_id (nombre)")
        .eq("negocio_id", negocioId)
        .eq("cliente_id", clienteId)
        .eq("estado", "COMPLETADA"),
    ]);

    if (!perfil) return { ok: false, error: "No encontramos ese cliente." };

    const puntosActuales = (puntos ?? []).reduce((acc, p) => acc + p.cantidad_disponible, 0);

    const conteoServicio = new Map<string, number>();
    const conteoStaff = new Map<string, number>();
    for (const r of reservas ?? []) {
      const staffNombre = (r.staff as unknown as { nombre: string } | null)?.nombre;
      if (staffNombre) conteoStaff.set(staffNombre, (conteoStaff.get(staffNombre) ?? 0) + 1);
      for (const rs of r.reserva_servicio ?? []) {
        const nombre = (rs.servicio as unknown as { nombre: string } | null)?.nombre;
        if (nombre) conteoServicio.set(nombre, (conteoServicio.get(nombre) ?? 0) + 1);
      }
    }
    const masFrecuente = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const ltv = vista ? Number(vista.ltv) : 0;

    return {
      ok: true,
      data: {
        clienteId,
        nombre: perfil.nombre,
        fotoUrl: perfil.avatar_url,
        telefono: perfil.telefono,
        email: perfil.email,
        fechaNacimiento: perfil.fecha_nacimiento,
        visitas: vista?.visitas ?? 0,
        ultimaVisita: vista?.ultima_visita ?? null,
        ltv,
        esVip: ltv >= UMBRAL_VIP,
        puntosActuales,
        servicioFavorito: masFrecuente(conteoServicio),
        staffPreferido: masFrecuente(conteoStaff),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface ReservaHistorial {
  id: string;
  horaInicio: string;
  estado: string;
  montoTotal: number;
  servicios: string;
  staffNombre: string | null;
  resena: { calificacion: number; comentario: string | null } | null;
}

export async function listarHistorialCliente(negocioId: string, clienteId: string): Promise<Resultado<ReservaHistorial[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("reserva")
      .select(
        `id, hora_inicio, estado, monto_total,
         staff:staff_id (nombre),
         reserva_servicio (servicio:servicio_id (nombre)),
         resena (calificacion, comentario)`
      )
      .eq("negocio_id", negocioId)
      .eq("cliente_id", clienteId)
      .order("hora_inicio", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: error.message };

    const items: ReservaHistorial[] = (data ?? []).map((r) => ({
      id: r.id,
      horaInicio: r.hora_inicio,
      estado: r.estado,
      montoTotal: r.monto_total,
      staffNombre: (r.staff as unknown as { nombre: string } | null)?.nombre ?? null,
      servicios: (r.reserva_servicio ?? [])
        .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
        .filter(Boolean)
        .join(" + "),
      resena: (r.resena as unknown as { calificacion: number; comentario: string | null } | null) ?? null,
    }));
    return { ok: true, data: items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Notas ────────────────────────────────────────────────────────────────

export interface NotaCliente {
  id: string;
  texto: string;
  createdAt: string;
  autorNombre: string | null;
}

export async function listarNotas(negocioId: string, clienteId: string): Promise<Resultado<NotaCliente[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("cliente_nota")
      .select("id, texto, created_at, autor_id")
      .eq("negocio_id", negocioId)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };

    const autorIds = [...new Set((data ?? []).map((n) => n.autor_id))];
    const { data: staffAutores } = autorIds.length
      ? await supabase.from("staff").select("usuario_id, nombre").in("usuario_id", autorIds)
      : { data: [] as { usuario_id: string; nombre: string }[] };
    const nombresPorId = new Map((staffAutores ?? []).map((s) => [s.usuario_id, s.nombre]));

    return {
      ok: true,
      data: (data ?? []).map((n) => ({
        id: n.id,
        texto: n.texto,
        createdAt: n.created_at,
        autorNombre: nombresPorId.get(n.autor_id) ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearNota(negocioId: string, clienteId: string, texto: string): Promise<Resultado> {
  try {
    const { supabase, userId } = await usuarioActual();
    if (!texto.trim()) return { ok: false, error: "La nota no puede estar vacía." };
    const { error } = await supabase.from("cliente_nota").insert({
      negocio_id: negocioId,
      cliente_id: clienteId,
      autor_id: userId,
      texto: texto.trim(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/panel/crm/${clienteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function eliminarNota(id: string, clienteId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.from("cliente_nota").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/panel/crm/${clienteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Etiquetas manuales ───────────────────────────────────────────────────

export async function listarEtiquetasNegocio(negocioId: string): Promise<Resultado<string[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.from("cliente_etiqueta").select("etiqueta").eq("negocio_id", negocioId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: [...new Set((data ?? []).map((e) => e.etiqueta))].sort() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function agregarEtiqueta(negocioId: string, clienteId: string, etiqueta: string): Promise<Resultado> {
  try {
    const { supabase, userId } = await usuarioActual();
    const limpia = etiqueta.trim();
    if (!limpia) return { ok: false, error: "La etiqueta no puede estar vacía." };
    const { error } = await supabase.from("cliente_etiqueta").insert({
      negocio_id: negocioId,
      cliente_id: clienteId,
      etiqueta: limpia,
      creado_por: userId,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ese cliente ya tiene esa etiqueta." };
      return { ok: false, error: error.message };
    }
    revalidatePath(`/panel/crm/${clienteId}`);
    revalidatePath("/panel/crm");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function quitarEtiqueta(negocioId: string, clienteId: string, etiqueta: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase
      .from("cliente_etiqueta")
      .delete()
      .eq("negocio_id", negocioId)
      .eq("cliente_id", clienteId)
      .eq("etiqueta", etiqueta);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/panel/crm/${clienteId}`);
    revalidatePath("/panel/crm");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Fotos de resultados (bucket crm-fotos, ya existía desde 007) ───────

export interface FotoCliente {
  id: string;
  url: string;
  createdAt: string;
}

export async function listarFotos(negocioId: string, clienteId: string): Promise<Resultado<FotoCliente[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("reserva_foto")
      .select("id, url, created_at")
      .eq("negocio_id", negocioId)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map((f) => ({ id: f.id, url: f.url, createdAt: f.created_at })) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function subirFoto(datos: {
  negocioId: string;
  clienteId: string;
  reservaId: string;
  dataUrl: string;
  consentimiento: boolean;
}): Promise<Resultado> {
  try {
    const { supabase, userId } = await usuarioActual();
    if (!datos.consentimiento) {
      return { ok: false, error: "Necesitás el consentimiento explícito del Cliente para subir esta foto." };
    }

    const match = /^data:(image\/\w+);base64,(.+)$/.exec(datos.dataUrl);
    if (!match) return { ok: false, error: "Imagen inválida." };
    const [, mime, base64] = match;
    const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 10 * 1024 * 1024) return { ok: false, error: "La imagen no puede superar 10 MB." };

    const ruta = `${datos.negocioId}/${datos.clienteId}/${datos.reservaId}-${Date.now()}.${ext}`;
    const { error: eUpload } = await supabase.storage.from("crm-fotos").upload(ruta, bytes, { contentType: mime });
    if (eUpload) return { ok: false, error: eUpload.message };

    const { data: pub } = supabase.storage.from("crm-fotos").getPublicUrl(ruta);

    const { error } = await supabase.from("reserva_foto").insert({
      reserva_id: datos.reservaId,
      negocio_id: datos.negocioId,
      cliente_id: datos.clienteId,
      url: pub.publicUrl,
      consentimiento: true,
      subido_por: userId,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/panel/crm/${datos.clienteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function eliminarFoto(id: string, clienteId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.from("reserva_foto").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/panel/crm/${clienteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Reservas COMPLETADA de un cliente sin foto aún (para subir una nueva) ─

export async function listarReservasCompletadas(negocioId: string, clienteId: string): Promise<Resultado<{ id: string; horaInicio: string }[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("reserva")
      .select("id, hora_inicio")
      .eq("negocio_id", negocioId)
      .eq("cliente_id", clienteId)
      .eq("estado", "COMPLETADA")
      .order("hora_inicio", { ascending: false })
      .limit(20);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map((r) => ({ id: r.id, horaInicio: r.hora_inicio })) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Lealtad transversal (ADR-011 + extensión del fundador, 2026-09-16) ──
// Beneficios activos de este Cliente EN ESTE NEGOCIO — nunca datos de
// otros negocios (aislamiento multi-tenant, RLS `tiene_acceso_interno`).
export interface BeneficiosLealtadCliente {
  membresiaActiva: { planNombre: string; usosMesActual: number; limiteUsosMes: number | null } | null;
  nivelVip: string | null;
  sellosProgreso: { campanaNombre: string; sellosActuales: number; sellosRequeridos: number }[];
  cashbackPendiente: number;
}

export async function obtenerBeneficiosLealtadCliente(negocioId: string, clienteId: string): Promise<Resultado<BeneficiosLealtadCliente>> {
  try {
    const { supabase } = await usuarioActual();

    const [membresiaRes, vipRes, sellosRes, cashbackRes] = await Promise.all([
      supabase
        .from("cliente_membresia")
        .select("usos_mes_actual, membresia_plan:plan_id (nombre, limite_usos_mes)")
        .eq("cliente_id", clienteId).eq("negocio_id", negocioId).eq("estado", "ACTIVA").maybeSingle(),
      supabase
        .from("vip_miembro")
        .select("vip_nivel:nivel_id (nombre)")
        .eq("cliente_id", clienteId).eq("negocio_id", negocioId).maybeSingle(),
      supabase
        .from("sello_cliente")
        .select("sellos_actuales, sello_campana:campana_id (nombre, sellos_requeridos, negocio_id)")
        .eq("cliente_id", clienteId),
      supabase
        .from("cashback_movimiento")
        .select("monto, cashback_regla:regla_id (negocio_id)")
        .eq("cliente_id", clienteId).eq("estado", "DISPONIBLE"),
    ]);

    const plan = membresiaRes.data?.membresia_plan as unknown as { nombre: string; limite_usos_mes: number | null } | null;
    const nivel = vipRes.data?.vip_nivel as unknown as { nombre: string } | null;

    const sellos = (sellosRes.data ?? [])
      .map((s) => ({ ...s, campana: s.sello_campana as unknown as { nombre: string; sellos_requeridos: number; negocio_id: string } | null }))
      .filter((s) => s.campana?.negocio_id === negocioId)
      .map((s) => ({ campanaNombre: s.campana!.nombre, sellosActuales: s.sellos_actuales, sellosRequeridos: s.campana!.sellos_requeridos }));

    const cashbackPendiente = (cashbackRes.data ?? [])
      .filter((c) => (c.cashback_regla as unknown as { negocio_id: string } | null)?.negocio_id === negocioId)
      .reduce((acc, c) => acc + Number(c.monto), 0);

    return {
      ok: true,
      data: {
        membresiaActiva: membresiaRes.data ? { planNombre: plan?.nombre ?? "—", usosMesActual: membresiaRes.data.usos_mes_actual, limiteUsosMes: plan?.limite_usos_mes ?? null } : null,
        nivelVip: nivel?.nombre ?? null,
        sellosProgreso: sellos,
        cashbackPendiente,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
