import { BarraSuperior } from "@/components/layout/header";
import { derivarRolEquipo, type RolEquipo } from "@/lib/auth/roles-equipo";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { obtenerCupoPlan } from "@/lib/planes/cupo";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { obtenerHistorialStaff } from "../actions";
import { DetalleStaff } from "./detalle-staff";
import { HorarioDelStaff, type TramoDia } from "./horario-del-staff";
import { ServiciosDelStaff, type ServicioAsignable } from "./servicios-del-staff";

export const metadata = { title: "Detalle de Staff" };

export default async function StaffDetallePage(props: PageProps<"/panel/staff/[id]">) {
  const { id } = await props.params;
  const contexto = await verificarAccesoPanel(["BARBERIA", "ADMIN", "GUARDIAN"], `/panel/staff/${id}`);

  const supabase = await createClient();

  // vista_staff_negocio hereda RLS real (security_invoker): a Guardian esta
  // consulta ya le devuelve NULL si el vínculo no es de su propia sede — el
  // notFound() de abajo es una segunda capa, no la única.
  const { data: staff } = await supabase
    .from("vista_staff_negocio")
    .select("*")
    .eq("vinculo_id", id)
    .maybeSingle();
  if (!staff) notFound();
  if (staff.negocio_id !== contexto.negocioId) notFound();

  // El rol lo calcula la base de datos (rol_equipo): el propietario se deriva de negocio.owner_user_id, no del vínculo.
  const [{ data: rolDb }, cupo] = await Promise.all([
    supabase.rpc("rol_equipo", { p_negocio_id: staff.negocio_id!, p_usuario_id: staff.staff_id! }),
    contexto.rol === "BARBERIA" ? obtenerCupoPlan(staff.negocio_id!) : Promise.resolve(null),
  ]);
  const rolEquipo: RolEquipo =
    (rolDb as RolEquipo | null) ??
    derivarRolEquipo({ esPropietario: false, esAdmin: staff.es_admin ?? false, prestaServicios: staff.presta_servicios ?? true });

  // Un administrador delegado solo gestiona a quien no es administrador (lo hace cumplir la RPC; aquí solo se ocultan los botones).
  const gestionable = contexto.rol !== "ADMIN" || (!(staff.es_admin ?? false) && rolEquipo !== "BUSINESS_OWNER" && staff.staff_id !== contexto.userId);
  const permisos = gestionable
    ? contexto.permisos
    : {
        ...contexto.permisos,
        suspenderStaff: false,
        reactivarStaff: false,
        retirarStaff: false,
        trasladarStaff: false,
        promoverGuardian: false,
        revocarGuardian: false,
      };
  const puedeCambiarRol = contexto.rol === "BARBERIA" && rolEquipo !== "BUSINESS_OWNER" && staff.estado !== "RETIRADO";
  const sinCupoDisponible = cupo?.capacidad?.disponibles != null && cupo.capacidad.disponibles < 1;

  const [{ data: otrasSedes }, resHistorial] = await Promise.all([
    permisos.trasladarStaff
      ? supabase
          .from("sede")
          .select("id, nombre")
          .eq("negocio_id", staff.negocio_id!)
          .neq("id", staff.sede_id ?? "")
          .eq("cerrada_permanente", false)
          .eq("cerrada_temporalmente", false)
      : Promise.resolve({ data: [] }),
    // El propio RLS de evento_auditoria ya limita esto a Barbería — se pide
    // igual para Guardian y llega vacío, sin exponer nada.
    obtenerHistorialStaff(id),
  ]);

  // Servicios del negocio y cuáles presta esta persona (solo si atiende clientes y quien mira es el propietario).
  let serviciosAsignables: ServicioAsignable[] | null = null;
  if (contexto.rol === "BARBERIA" && (staff.presta_servicios ?? true) && staff.estado !== "RETIRADO") {
    const [{ data: servicios }, { data: asignados }] = await Promise.all([
      supabase.from("servicio").select("id, nombre, imagen_url, precio_base").eq("negocio_id", staff.negocio_id!).eq("estado", "ACTIVO").order("nombre"),
      supabase.from("staff_servicio").select("servicio_id").eq("staff_id", staff.staff_id!),
    ]);
    const mios = new Set((asignados ?? []).map((a) => a.servicio_id));
    serviciosAsignables = (servicios ?? []).map((s) => ({ id: s.id, nombre: s.nombre, imagen_url: s.imagen_url, precio_base: s.precio_base, asignado: mios.has(s.id) }));
  }

  // Horario semanal: solo el propietario lo define por la persona (la base lo exige de nuevo) y solo si atiende clientes.
  let bloqueHorario: React.ReactNode = null;
  if (contexto.rol === "BARBERIA" && (staff.presta_servicios ?? true) && staff.estado === "ACTIVO") {
    const [{ data: sedesNegocio }, { data: filas }] = await Promise.all([
      supabase.from("sede").select("id, nombre").eq("negocio_id", staff.negocio_id!).eq("cerrada_permanente", false).order("nombre"),
      supabase.from("disponibilidad").select("sede_id, dia_semana, hora_inicio, hora_fin").eq("vinculo_id", id),
    ]);
    // Si la persona está fijada a una sede, solo esa; si no, todas las del negocio.
    const sedesHorario = (sedesNegocio ?? []).filter((s) => !staff.sede_id || s.id === staff.sede_id);
    if (sedesHorario.length > 0) {
      const porSede: Record<string, TramoDia[]> = {};
      for (const f of filas ?? []) (porSede[f.sede_id] ??= []).push({ dia: f.dia_semana, inicio: f.hora_inicio.slice(0, 5), fin: f.hora_fin.slice(0, 5) });
      bloqueHorario = (
        <HorarioDelStaff
          vinculoId={id}
          nombre={staff.nombre ?? "Esta persona"}
          sedes={sedesHorario}
          sedeInicial={sedesHorario[0].id}
          porSede={porSede}
          serviciosAsignados={serviciosAsignables ? serviciosAsignables.filter((s) => s.asignado).length : null}
        />
      );
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app pb-16">
      <BarraSuperior titulo={staff.nombre!} volverA="/panel/staff" />
      <DetalleStaff
        staff={staff}
        permisos={permisos}
        otrasSedes={otrasSedes ?? []}
        historialInicial={resHistorial.ok ? resHistorial.data : []}
        rolEquipo={rolEquipo}
        puedeCambiarRol={puedeCambiarRol}
        sinCupoDisponible={sinCupoDisponible}
        bloqueHorario={bloqueHorario}
        bloqueServicios={
          serviciosAsignables ? (
            <ServiciosDelStaff staffId={staff.staff_id!} nombre={staff.nombre ?? "Esta persona"} inicial={serviciosAsignables} puedeCatalogo />
          ) : null
        }
      />
    </div>
  );
}
