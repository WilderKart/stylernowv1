"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { puntuar } from "@/lib/busqueda/difuso";
import { aEvento, type FilaAuditoria } from "@/lib/auditoria/listado";
import { createClient } from "@/lib/supabase/server";

/**
 * Buscador y actividad del panel (spa, salón y uñas). Cero confianza: el negocio, el rol y la sede salen de la sesión en el
 * servidor (resolverContexto), nunca del navegador. Todas las consultas usan la sesión del usuario (RLS) y además filtran por
 * su negocio. El texto buscado solo se compara en memoria con datos ya autorizados; jamás se concatena en SQL.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ItemBusqueda {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  aproximado: boolean;
}
export interface GrupoBusqueda {
  clave: string;
  titulo: string;
  items: ItemBusqueda[];
}
export interface RespuestaBusqueda {
  grupos: GrupoBusqueda[];
  hayAproximados: boolean;
}

export interface ActividadItem {
  clave: string;
  titulo: string;
  detalle: string;
  fecha: string;
  href: string;
  tono: "violet" | "green" | "amber" | "rose" | "blue";
}

type Ctx = { supabase: Awaited<ReturnType<typeof createClient>>; negocioId: string; sedeId: string | null; rol: "BARBERIA" | "GUARDIAN" | "ADMIN" };

async function contextoPanel(): Promise<Ctx> {
  const c = await resolverContexto();
  if (!c.userId || !c.negocioId || (c.rol !== "BARBERIA" && c.rol !== "GUARDIAN" && c.rol !== "ADMIN")) throw new Error("NO_AUTORIZADO");
  return { supabase: await createClient(), negocioId: c.negocioId, sedeId: c.rol === "GUARDIAN" ? c.sedeId : null, rol: c.rol };
}

// ── Índice de secciones y configuraciones (según el rol, igual que el menú) ──────────────────────────
interface Seccion {
  href: string;
  titulo: string;
  grupo: string;
  claves: string;
  nivel: "operativo" | "dueno" | "guardian";
}
const SECCIONES: Seccion[] = [
  { href: "/panel", titulo: "Resumen", grupo: "Panel", claves: "inicio panel indicadores cifras bienvenida", nivel: "operativo" },
  { href: "/panel/agenda", titulo: "Agenda", grupo: "Agenda", claves: "citas calendario dia semana mes reservas horarios", nivel: "operativo" },
  { href: "/panel/crm", titulo: "Clientes", grupo: "Agenda", claves: "crm clientes contactos fidelidad etiquetas notas", nivel: "operativo" },
  { href: "/panel/pos", titulo: "Caja", grupo: "Agenda", claves: "pos cobrar venta ventas punto de venta propinas", nivel: "operativo" },
  { href: "/panel/inventario", titulo: "Inventario", grupo: "Agenda", claves: "productos stock existencias insumos", nivel: "operativo" },
  { href: "/panel/staff", titulo: "Equipo (Staff)", grupo: "Equipo y servicios", claves: "staff profesionales empleados invitar equipo comisiones administradores", nivel: "operativo" },
  { href: "/panel/staff/solicitudes", titulo: "Solicitudes del equipo", grupo: "Equipo y servicios", claves: "ausencias permisos vacaciones horarios solicitudes", nivel: "operativo" },
  { href: "/panel/servicios", titulo: "Servicios", grupo: "Equipo y servicios", claves: "servicios precios duracion catalogo tratamientos", nivel: "operativo" },
  { href: "/panel/sedes", titulo: "Sedes", grupo: "Equipo y servicios", claves: "sedes sucursales direccion horario cierre ubicacion", nivel: "dueno" },
  { href: "/panel/promociones", titulo: "Promociones", grupo: "Marketing", claves: "promociones descuentos ofertas cupones", nivel: "dueno" },
  { href: "/panel/ads", titulo: "Publicidad", grupo: "Marketing", claves: "publicidad anuncios ads campanas destacar", nivel: "dueno" },
  { href: "/panel/lealtad", titulo: "Lealtad", grupo: "Marketing", claves: "lealtad fidelidad sellos membresias cashback referidos vip", nivel: "dueno" },
  { href: "/panel/whatsapp", titulo: "WhatsApp", grupo: "Marketing", claves: "whatsapp mensajes campanas recordatorios", nivel: "dueno" },
  { href: "/panel/ia", titulo: "IA", grupo: "Marketing", claves: "inteligencia artificial asistente sugerencias", nivel: "dueno" },
  { href: "/panel/cobros", titulo: "Cobros", grupo: "Finanzas", claves: "cobros pagos transferencias pagos por revisar metodos de pago", nivel: "dueno" },
  { href: "/panel/libro", titulo: "Libro contable", grupo: "Finanzas", claves: "libro contable movimientos ingresos egresos", nivel: "dueno" },
  { href: "/panel/wallet", titulo: "Wallet", grupo: "Finanzas", claves: "wallet saldo billetera retiros", nivel: "dueno" },
  { href: "/panel/reportes", titulo: "Reportes", grupo: "Finanzas", claves: "reportes estadisticas ingresos ranking servicios top resenas", nivel: "guardian" },
  { href: "/panel/politica", titulo: "Anticipo y cancelaciones", grupo: "Finanzas", claves: "politica anticipo sena cancelacion reembolso no show", nivel: "dueno" },
  { href: "/panel/suscripcion", titulo: "Mi Plan", grupo: "Finanzas", claves: "plan suscripcion facturacion mensual anual precio fundador", nivel: "dueno" },
  { href: "/panel/perfil-publico", titulo: "Perfil público", grupo: "Mi negocio", claves: "perfil publico descripcion fotos portada enlace de reserva", nivel: "dueno" },
  { href: "/panel/marca", titulo: "Mi Marca", grupo: "Mi negocio", claves: "marca logo colores identidad", nivel: "dueno" },
  { href: "/panel/verificacion", titulo: "Verificación", grupo: "Mi negocio", claves: "verificacion documentos negocio verificado", nivel: "dueno" },
  { href: "/panel/auditoria", titulo: "Auditoría", grupo: "Mi negocio", claves: "auditoria historial cambios registro actividad", nivel: "dueno" },
  { href: "/panel/soporte", titulo: "Soporte", grupo: "Mi negocio", claves: "soporte ayuda tickets contacto chat", nivel: "guardian" },
];

function seccionesVisibles(rol: Ctx["rol"]) {
  if (rol === "ADMIN") return SECCIONES.filter((s) => s.href === "/panel/staff");
  if (rol === "BARBERIA") return SECCIONES;
  return SECCIONES.filter((s) => s.nivel !== "dueno");
}

const ESTADO_RESERVA: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  COMPLETADA: "Pagada",
  NO_SHOW: "No asistió",
  CANCELADA: "Cancelada",
};
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

function ordenar<T extends { puntaje: number; aproximada: boolean }>(a: T, b: T) {
  return Number(a.aproximada) - Number(b.aproximada) || b.puntaje - a.puntaje;
}

export async function buscarEnPanel(consulta: string): Promise<Resultado<RespuestaBusqueda>> {
  try {
    const q = String(consulta ?? "").trim().slice(0, 60);
    if (q.length < 2) return { ok: true, data: { grupos: [], hayAproximados: false } };
    const { supabase, negocioId, sedeId, rol } = await contextoPanel();

    const rpc = supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: { fila: Record<string, unknown> }[] | null; error: unknown }>;
    const desde = new Date(Date.now() - 90 * 86400000).toISOString();
    const hasta = new Date(Date.now() + 90 * 86400000).toISOString();

    let reservasQ = supabase
      .from("reserva")
      .select("id, estado, hora_inicio, cliente:cliente_id (nombre), staff:staff_id (nombre), reserva_servicio (servicio:servicio_id (nombre))")
      .eq("negocio_id", negocioId)
      .gte("hora_inicio", desde)
      .lte("hora_inicio", hasta)
      .order("hora_inicio", { ascending: false })
      .limit(400);
    if (sedeId) reservasQ = reservasQ.eq("sede_id", sedeId);

    let serviciosQ = supabase.from("servicio").select("id, nombre, descripcion, precio_base, estado").eq("negocio_id", negocioId).limit(300);
    if (rol === "ADMIN") serviciosQ = serviciosQ.limit(0);
    const sedesQ = supabase.from("sede").select("id, nombre, ciudad, direccion").eq("negocio_id", negocioId).eq("cerrada_permanente", false).limit(100);
    let staffQ = supabase.from("vista_staff_negocio").select("vinculo_id, nombre, especialidad, email, estado").eq("negocio_id", negocioId).neq("estado", "RETIRADO").limit(300);
    if (sedeId) staffQ = staffQ.eq("sede_id", sedeId);

    const [clientesRes, reservasRes, serviciosRes, sedesRes, staffRes] = await Promise.all([
      rol === "ADMIN"
        ? Promise.resolve({ data: null, error: null })
        : rpc.call(supabase, "crm_clientes_filtrados", {
            p_negocio_id: negocioId,
            p_sede_id: sedeId,
            p_etiqueta: null,
            p_solo_consentimiento: false,
            p_patron_nombre: null,
            p_patron_telefono: null,
            p_ltv_min: null,
            p_ltv_max: null,
            p_ultima_despues: null,
            p_ultima_antes: null,
            p_primera_despues: null,
            p_primera_antes: null,
            p_orden: "nombre",
            p_offset: 0,
            p_limite: 1500,
          }),
      rol === "ADMIN" ? Promise.resolve({ data: [] }) : reservasQ,
      serviciosQ,
      sedesQ,
      staffQ,
    ]);

    const grupos: GrupoBusqueda[] = [];
    let hayAproximados = false;
    const cerrar = <T extends { puntaje: number; aproximada: boolean }>(clave: string, titulo: string, filas: T[], aItem: (f: T) => ItemBusqueda) => {
      if (filas.length === 0) return;
      const items = filas.sort(ordenar).slice(0, 5).map(aItem);
      if (items.some((i) => i.aproximado)) hayAproximados = true;
      grupos.push({ clave, titulo, items });
    };

    // Secciones y configuraciones
    cerrar(
      "secciones",
      "Secciones y configuración",
      seccionesVisibles(rol).flatMap((s) => {
        const m = puntuar(q, [s.titulo, s.titulo, s.claves]);
        return m ? [{ s, ...m }] : [];
      }),
      ({ s, aproximada }) => ({ id: s.href, titulo: s.titulo, detalle: s.grupo, href: s.href, aproximado: aproximada }),
    );

    // Clientes
    const clientes = (clientesRes.data ?? []).map((x) => x.fila as { cliente_id: string; cliente_nombre: string; cliente_telefono: string | null; visitas: number; ultima_visita: string | null });
    cerrar(
      "clientes",
      "Clientes",
      clientes.flatMap((c) => {
        const m = puntuar(q, [c.cliente_nombre, c.cliente_telefono]);
        return m ? [{ c, ...m }] : [];
      }),
      ({ c, aproximada }) => ({
        id: c.cliente_id,
        titulo: c.cliente_nombre,
        detalle: [c.cliente_telefono, `${c.visitas} ${Number(c.visitas) === 1 ? "visita" : "visitas"}`].filter(Boolean).join(" · "),
        href: `/panel/crm/${c.cliente_id}`,
        aproximado: aproximada,
      }),
    );

    // Citas y reservas
    type FilaReserva = { id: string; estado: string; hora_inicio: string; cliente: { nombre: string } | null; staff: { nombre: string } | null; reserva_servicio: { servicio: { nombre: string } | null }[] | null };
    cerrar(
      "reservas",
      "Citas y reservas",
      ((reservasRes.data ?? []) as unknown as FilaReserva[]).flatMap((r) => {
        const servicios = (r.reserva_servicio ?? []).map((x) => x.servicio?.nombre).filter(Boolean) as string[];
        const m = puntuar(q, [r.cliente?.nombre, servicios.join(" "), r.staff?.nombre, ESTADO_RESERVA[r.estado], fechaHora(r.hora_inicio)]);
        return m ? [{ r, servicios, ...m }] : [];
      }),
      ({ r, servicios, aproximada }) => ({
        id: r.id,
        titulo: `${r.cliente?.nombre ?? "Cliente"} · ${fechaHora(r.hora_inicio)}`,
        detalle: [servicios.join(", ") || "Sin servicio", r.staff?.nombre, ESTADO_RESERVA[r.estado] ?? r.estado].filter(Boolean).join(" · "),
        href: "/panel/agenda",
        aproximado: aproximada,
      }),
    );

    // Servicios
    cerrar(
      "servicios",
      "Servicios",
      (serviciosRes.data ?? []).flatMap((s) => {
        const m = puntuar(q, [s.nombre, s.nombre, s.descripcion]);
        return m ? [{ s, ...m }] : [];
      }),
      ({ s, aproximada }) => ({
        id: s.id,
        titulo: s.nombre,
        detalle: `${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(s.precio_base))}${s.estado === "ACTIVO" ? "" : " · Inactivo"}`,
        href: "/panel/servicios",
        aproximado: aproximada,
      }),
    );

    // Equipo
    cerrar(
      "equipo",
      "Equipo",
      (staffRes.data ?? []).flatMap((s) => {
        const m = puntuar(q, [s.nombre, s.nombre, s.especialidad, s.email]);
        return m && s.vinculo_id ? [{ s, ...m }] : [];
      }),
      ({ s, aproximada }) => ({ id: s.vinculo_id!, titulo: s.nombre ?? "Profesional", detalle: s.especialidad ?? "Profesional", href: `/panel/staff/${s.vinculo_id}`, aproximado: aproximada }),
    );

    // Sedes
    if (rol !== "ADMIN") {
      cerrar(
        "sedes",
        "Sedes",
        (sedesRes.data ?? []).flatMap((s) => {
          const m = puntuar(q, [s.nombre, s.nombre, s.ciudad, s.direccion]);
          return m ? [{ s, ...m }] : [];
        }),
        ({ s, aproximada }) => ({ id: s.id, titulo: s.nombre, detalle: `${s.direccion} · ${s.ciudad}`, href: rol === "BARBERIA" ? `/panel/sedes/${s.id}` : "/panel/sedes", aproximado: aproximada }),
      );
    }

    return { ok: true, data: { grupos, hayAproximados } };
  } catch {
    return { ok: false, error: "No pudimos buscar ahora. Inténtalo de nuevo." };
  }
}

// ── Actividad del panel (campana) ───────────────────────────────────────────────────────────────────
const TEXTO_ACCION: Record<string, string> = { CREAR: "Se creó", ACTUALIZAR: "Se actualizó", ELIMINAR: "Se eliminó", INSERT: "Se creó", UPDATE: "Se actualizó", DELETE: "Se eliminó" };
const TILDES: Record<string, string> = { verificacion: "verificación", invitacion: "invitación", documentacion: "documentación", configuracion: "configuración", cancelacion: "cancelación", politica: "política", suscripcion: "suscripción", facturacion: "facturación", publicacion: "publicación", autorizacion: "autorización", aprobacion: "aprobación", revision: "revisión", comision: "comisión", promocion: "promoción", reservacion: "reservación", categoria: "categoría" };
function humano(s: string) {
  const t = s
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((w) => TILDES[w] ?? w)
    .join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export async function listarActividadPanel(): Promise<Resultado<ActividadItem[]>> {
  try {
    const { supabase, negocioId, sedeId, rol } = await contextoPanel();
    const items: ActividadItem[] = [];

    // 1) Reservas: nuevas y cambios de estado recientes (alcance de su sede si es Guardian).
    if (rol !== "ADMIN") {
      let q = supabase
        .from("reserva")
        .select("id, estado, created_at, updated_at, hora_inicio, cliente:cliente_id (nombre)")
        .eq("negocio_id", negocioId)
        .order("updated_at", { ascending: false })
        .limit(25);
      if (sedeId) q = q.eq("sede_id", sedeId);
      const { data } = await q;
      for (const r of (data ?? []) as unknown as { id: string; estado: string; created_at: string; updated_at: string; hora_inicio: string; cliente: { nombre: string } | null }[]) {
        const nuevo = Math.abs(new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) < 5000;
        const cliente = r.cliente?.nombre ?? "Un cliente";
        items.push({
          clave: `res-${r.id}-${r.updated_at}`,
          titulo: nuevo ? "Nueva reserva" : `Reserva ${(ESTADO_RESERVA[r.estado] ?? r.estado).toLowerCase()}`,
          detalle: `${cliente} · ${fechaHora(r.hora_inicio)}`,
          fecha: r.updated_at,
          href: "/panel/agenda",
          tono: r.estado === "CANCELADA" || r.estado === "NO_SHOW" ? "rose" : r.estado === "COMPLETADA" ? "green" : r.estado === "PENDIENTE_PAGO" ? "amber" : "violet",
        });
      }
    }

    // 1b) Mensajes que los clientes escriben en el chat de su cita (RLS: solo los de este negocio).
    if (rol !== "ADMIN") {
      const { data: msgs } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => { order: (c: string, o: object) => { limit: (n: number) => Promise<{ data: unknown }> } };
          };
        };
      })
        .from("chat_mensaje")
        .select("id, cuerpo, created_at, conversacion:conversacion_id (reserva_id, negocio_id, cliente:cliente_id (nombre))")
        .eq("autor_rol", "CLIENTE")
        .order("created_at", { ascending: false })
        .limit(15);
      for (const m of (msgs ?? []) as { id: string; cuerpo: string; created_at: string; conversacion: { negocio_id: string; cliente: { nombre: string } | null } | null }[]) {
        if (m.conversacion?.negocio_id !== negocioId) continue;
        items.push({
          clave: `chat-${m.id}`,
          titulo: `Mensaje de ${m.conversacion?.cliente?.nombre ?? "un cliente"}`,
          detalle: m.cuerpo.length > 90 ? `${m.cuerpo.slice(0, 90)}…` : m.cuerpo,
          fecha: m.created_at,
          href: "/panel/agenda",
          tono: "violet",
        });
      }
    }

    // 2) Auditoría del negocio (solo el dueño, igual que el módulo Auditoría): altas, cambios y retiros.
    if (rol === "BARBERIA") {
      const rpc = supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: unknown }> };
      const { data } = await rpc.rpc("auditoria_listar", { p_negocio_id: negocioId, p_entidad_tipo: null, p_accion: null, p_desde: null, p_hasta: null, p_limite: 25, p_offset: 0 });
      for (const f of (data ?? []) as FilaAuditoria[]) {
        const e = aEvento(f);
        // Las reservas ya se listan arriba con más detalle.
        if (/reserva/i.test(e.entidadTipo)) continue;
        items.push({
          clave: `aud-${e.id}`,
          titulo: TEXTO_ACCION[e.accion.toUpperCase()] ? `${TEXTO_ACCION[e.accion.toUpperCase()]} ${humano(e.entidadTipo).toLowerCase()}` : humano(e.accion),
          detalle: e.actorNombre ? `Por ${e.actorNombre}` : e.motivo ?? "Registro de auditoría",
          fecha: e.createdAt,
          href: "/panel/auditoria",
          tono: "blue",
        });
      }
    }

    items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return { ok: true, data: items.slice(0, 30) };
  } catch {
    return { ok: false, error: "No pudimos cargar la actividad." };
  }
}
