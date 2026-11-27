import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CatalogoServicios } from "./catalogo-servicios";

export const metadata = { title: "Catálogo de servicios" };

export default async function CatalogoServiciosPage() {
  // Solo el propietario crea servicios (la base lo exige de nuevo).
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/servicios/catalogo");
  const negocioId = contexto.negocioId!;
  const supabase = await createClient();

  const [{ data: servicios }, { data: sedes }, { data: vinculos }] = await Promise.all([
    supabase.from("servicio").select("catalogo_ref").eq("negocio_id", negocioId).eq("estado", "ACTIVO").not("catalogo_ref", "is", null),
    supabase.from("sede").select("id, nombre").eq("negocio_id", negocioId).eq("cerrada_permanente", false).order("es_principal", { ascending: false }),
    supabase.from("vista_staff_negocio").select("staff_id, nombre, estado, presta_servicios").eq("negocio_id", negocioId),
  ]);

  const agregados = ((servicios ?? []) as unknown as Array<{ catalogo_ref: string | null }>).map((s) => s.catalogo_ref).filter((x): x is string => !!x);
  const equipo = ((vinculos ?? []) as Array<{ staff_id: string; nombre: string | null; estado: string; presta_servicios: boolean }>)
    .filter((v) => v.estado === "ACTIVO" && v.presta_servicios)
    .map((v) => ({ id: v.staff_id, nombre: v.nombre ?? "Profesional" }));

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-8 sm:px-8">
        <Link href="/panel/servicios" className="text-[12px] font-bold uppercase text-text-muted underline">
          ← Mis servicios
        </Link>
        <h1 className="poster-3 mb-1 mt-2 break-words">Catálogo de servicios</h1>
        <p className="mb-5 max-w-2xl text-[13px] text-text-muted">
          Toca un servicio para agregarlo a tu menú. Ya trae su imagen: tú solo defines el precio, la duración, las sedes y quién lo hace. ¿No está el tuyo?{" "}
          <Link href="/panel/servicios/nuevo" className="font-bold underline">
            Crea un servicio propio
          </Link>
          .
        </p>
        <CatalogoServicios negocioId={negocioId} agregadosIniciales={agregados} sedes={(sedes ?? []) as Array<{ id: string; nombre: string }>} equipo={equipo} />
      </main>
    </div>
  );
}
