import { BarraSuperior } from "@/components/layout/header";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { listarStaffAsignable } from "../actions";
import { DetalleServicio } from "./detalle-servicio";

export const metadata = { title: "Detalle de servicio" };

export default async function ServicioDetallePage(props: PageProps<"/panel/servicios/[id]">) {
  const { id } = await props.params;
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], `/panel/servicios/${id}`);

  const supabase = await createClient();
  const { data: servicio } = await supabase
    .from("servicio")
    .select(
      "id, negocio_id, nombre, descripcion, duracion_minutos, precio_base, categoria_puntaje, buffer_previo_minutos, buffer_posterior_minutos, estado, imagen_url, catalogo_ref"
    )
    .eq("id", id)
    .maybeSingle();
  if (!servicio) notFound();
  if (servicio.negocio_id !== contexto.negocioId) notFound();

  const [{ data: sedesRows }, { data: ocultas }] = await Promise.all([
    supabase.from("sede").select("id, nombre").eq("negocio_id", servicio.negocio_id).eq("cerrada_permanente", false).order("es_principal", { ascending: false }),
    (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { eq: (c: string, v: boolean) => Promise<{ data: Array<{ sede_id: string }> | null }> } } } })
      .from("servicio_sede").select("sede_id").eq("servicio_id", servicio.id).eq("activo", false),
  ]);
  const ocultasSet = new Set((ocultas ?? []).map((o) => o.sede_id));
  const sedes = (sedesRows ?? []).map((s) => ({ id: s.id, nombre: s.nombre, ofrece: !ocultasSet.has(s.id) }));

  const resStaff = contexto.permisos.asignarStaffServicio
    ? await listarStaffAsignable(servicio.negocio_id, servicio.id)
    : null;

  return (
    <div className="flex min-h-dvh flex-col bg-app pb-16">
      <BarraSuperior titulo={servicio.nombre} volverA="/panel/servicios" />
      <DetalleServicio
        servicio={servicio}
        permisos={contexto.permisos}
        staffAsignableInicial={resStaff?.ok ? resStaff.data : []}
        sedes={sedes}
        sedePropiaId={contexto.rol === "GUARDIAN" ? contexto.sedeId : null}
      />
    </div>
  );
}
